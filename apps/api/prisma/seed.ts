import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { superficieTotal } from '@vacker/domain';

// Seed idempotente (Paso 3): tenant Vacker + datos reales 2026 del prototipo
// (vendedores, ventas con puntas, alquileres). Corre con el rol `postgres`
// (BYPASSRLS), fuera del path de negocio, seteando tenant_id explícito.
const prisma = new PrismaClient();

interface VendedorSeed {
  nombre: string;
  estado: string;
  obj_vol: number;
  obj_puntas: number;
}
interface VentaSeed {
  id: string;
  fecha_reserva: string | null;
  fecha_firma: string | null;
  direccion: string;
  precio: number;
  moneda: string;
  punta_comp: string | null;
  punta_vend: string | null;
  cant_puntas: number;
  com_vend: number;
  com_comp: number;
  com_total: number;
  estado: string;
  obs: string | null;
}
interface AlquilerSeed {
  id: string;
  fecha_reserva: string | null;
  fecha_firma: string | null;
  direccion: string;
  valor_mensual: number;
  comision: number;
  obs: string | null;
}
interface DataSeed {
  vendedores: VendedorSeed[];
  ventas: VentaSeed[];
  alquileres: AlquilerSeed[];
}

const DATA: DataSeed = JSON.parse(
  readFileSync(join(__dirname, 'seed-data', 'tablero-2026.json'), 'utf8'),
) as DataSeed;

/** `YYYY-MM-DD` -> Date (UTC) o null. */
function toDate(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

/** Deriva { anio, mes } de firma ?? reserva. */
function periodo(
  firma: string | null,
  reserva: string | null,
): { anio: number | null; mes: number | null } {
  const ref = firma ?? reserva;
  if (!ref) return { anio: null, mes: null };
  return { anio: Number(ref.slice(0, 4)), mes: Number(ref.slice(5, 7)) };
}

/** nombre -> email placeholder estable (sin cuenta Auth todavía). */
function emailDe(nombre: string): string {
  const slug = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas combinantes (acentos)
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${slug}@vacker.com`;
}

const ESTADO_VENTA: Record<string, string> = {
  Escriturada: 'escriturada',
  Señada: 'senada',
};

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'vacker' },
    update: {},
    create: {
      nombre: 'Vacker Negocios Inmobiliarios',
      slug: 'vacker',
      plan: 'profesional',
      estado: 'activo',
    },
  });
  const tenantId = tenant.id;

  // --- Vendedores (usuarios comerciales, rol `vendedor`, sin líder) ---
  const idPorNombre = new Map<string, string>();
  for (const v of DATA.vendedores) {
    const email = emailDe(v.nombre);
    const usuario = await prisma.usuario.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { nombre: v.nombre, estado: v.estado === 'Activo' ? 'activo' : 'inactivo' },
      create: {
        id: randomUUID(),
        tenantId,
        nombre: v.nombre,
        email,
        estado: v.estado === 'Activo' ? 'activo' : 'inactivo',
      },
    });
    idPorNombre.set(v.nombre, usuario.id);
    await prisma.usuarioRol.upsert({
      where: { usuarioId_rol: { usuarioId: usuario.id, rol: 'vendedor' } },
      update: {},
      create: { usuarioId: usuario.id, rol: 'vendedor', tenantId },
    });
  }

  // --- Ventas (con 1-2 puntas normalizadas) ---
  let ventasOk = 0;
  for (const s of DATA.ventas) {
    const { anio, mes } = periodo(s.fecha_firma, s.fecha_reserva);
    const estado = ESTADO_VENTA[s.estado] ?? s.estado.toLowerCase();
    const op = await prisma.operacion.upsert({
      where: { tenantId_codigo: { tenantId, codigo: s.id } },
      update: {
        direccion: s.direccion,
        precio: s.precio,
        moneda: s.moneda,
        cantPuntas: s.cant_puntas,
        comTotal: s.com_total,
        estado,
        fechaReserva: toDate(s.fecha_reserva),
        fechaFirma: toDate(s.fecha_firma),
        anio,
        mes,
        obs: s.obs,
      },
      create: {
        tenantId,
        codigo: s.id,
        tipo: 'venta',
        direccion: s.direccion,
        precio: s.precio,
        moneda: s.moneda,
        cantPuntas: s.cant_puntas,
        comTotal: s.com_total,
        estado,
        fechaReserva: toDate(s.fecha_reserva),
        fechaFirma: toDate(s.fecha_firma),
        anio,
        mes,
        obs: s.obs,
      },
    });

    // Reset idempotente de puntas.
    await prisma.operacionPunta.deleteMany({ where: { operacionId: op.id } });
    const puntas: { lado: string; nombre: string; comision: number }[] = [];
    if (s.punta_vend) puntas.push({ lado: 'vendedora', nombre: s.punta_vend, comision: s.com_vend });
    if (s.punta_comp) puntas.push({ lado: 'compradora', nombre: s.punta_comp, comision: s.com_comp });
    for (const p of puntas) {
      const usuarioId = idPorNombre.get(p.nombre);
      if (!usuarioId) throw new Error(`Vendedor "${p.nombre}" (op ${s.id}) no existe en el seed.`);
      await prisma.operacionPunta.create({
        data: { operacionId: op.id, tenantId, lado: p.lado, usuarioId, comision: p.comision },
      });
    }
    ventasOk += 1;
  }

  // --- Alquileres (sin puntas, estado firmado) ---
  let alqOk = 0;
  for (const a of DATA.alquileres) {
    const { anio, mes } = periodo(a.fecha_firma, a.fecha_reserva);
    await prisma.operacion.upsert({
      where: { tenantId_codigo: { tenantId, codigo: a.id } },
      update: {
        direccion: a.direccion,
        valorMensual: a.valor_mensual,
        comTotal: a.comision,
        estado: 'firmado',
        fechaReserva: toDate(a.fecha_reserva),
        fechaFirma: toDate(a.fecha_firma),
        anio,
        mes,
        obs: a.obs,
      },
      create: {
        tenantId,
        codigo: a.id,
        tipo: 'alquiler',
        direccion: a.direccion,
        valorMensual: a.valor_mensual,
        moneda: 'USD',
        cantPuntas: 0,
        comTotal: a.comision,
        estado: 'firmado',
        fechaReserva: toDate(a.fecha_reserva),
        fechaFirma: toDate(a.fecha_firma),
        anio,
        mes,
        obs: a.obs,
      },
    });
    alqOk += 1;
  }

  // --- Tasaciones de ejemplo (Sprint 0 del Tasador): estados y meses
  // distintos, repartidas entre los vendedores ya creados arriba, para poder
  // demostrar el filtro por rol (tenant/equipo/propio) en Sprint 1+. ---
  const agentes = [...idPorNombre.values()];
  if (agentes.length > 0) {
    const TASACIONES_SEED: {
      codigo: string;
      cliente: string;
      direccion: string;
      tipoPropiedad: string;
      mes: number;
      cubierta: number;
      semicubierta: number;
      descubierta: number;
      estado: string;
      exclusividad?: { tipo: 'exclusiva'; dias: number } | { tipo: 'no' };
      motivoNoCaptada?: string;
    }[] = [
      { codigo: 'TAS-2026-001', cliente: 'María Fernández', direccion: 'Av. Libertador 4200', tipoPropiedad: 'Departamento', mes: 1, cubierta: 65, semicubierta: 0, descubierta: 6, estado: 'En proceso' },
      { codigo: 'TAS-2026-002', cliente: 'Jorge Ibáñez', direccion: 'Charcas 3100', tipoPropiedad: 'PH', mes: 2, cubierta: 90, semicubierta: 15, descubierta: 20, estado: 'Presentada' },
      { codigo: 'TAS-2026-003', cliente: 'Laura Gómez', direccion: 'Av. Cabildo 2050', tipoPropiedad: 'Departamento', mes: 2, cubierta: 48, semicubierta: 0, descubierta: 4, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 60 } },
      { codigo: 'TAS-2026-004', cliente: 'Diego Alonso', direccion: 'Ruta 8 km 45', tipoPropiedad: 'Casa', mes: 3, cubierta: 180, semicubierta: 25, descubierta: 300, estado: 'Captada', exclusividad: { tipo: 'no' } },
      { codigo: 'TAS-2026-005', cliente: 'Valeria Sosa', direccion: 'Bulnes 890', tipoPropiedad: 'Departamento', mes: 3, cubierta: 55, semicubierta: 0, descubierta: 0, estado: 'No captada', motivoNoCaptada: 'Desacuerdo de precio' },
      { codigo: 'TAS-2026-006', cliente: 'Nicolás Peralta', direccion: 'Av. Rivadavia 8800', tipoPropiedad: 'Local', mes: 4, cubierta: 70, semicubierta: 0, descubierta: 0, estado: 'En proceso' },
      { codigo: 'TAS-2026-007', cliente: 'Carla Duarte', direccion: 'Gorriti 4400', tipoPropiedad: 'PH', mes: 4, cubierta: 75, semicubierta: 10, descubierta: 15, estado: 'Presentada' },
      { codigo: 'TAS-2026-008', cliente: 'Federico Luna', direccion: 'Av. Santa Fe 3500', tipoPropiedad: 'Oficina', mes: 5, cubierta: 40, semicubierta: 0, descubierta: 0, estado: 'No captada', motivoNoCaptada: 'Ya no quiere vender' },
      { codigo: 'TAS-2026-009', cliente: 'Romina Castro', direccion: 'Av. Del Libertador 6800', tipoPropiedad: 'Casa', mes: 5, cubierta: 210, semicubierta: 30, descubierta: 150, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 90 } },
    ];

    let tasOk = 0;
    for (const [i, t] of TASACIONES_SEED.entries()) {
      const agenteId = agentes[i % agentes.length]!;
      await prisma.tasacion.upsert({
        where: { tenantId_codigo: { tenantId, codigo: t.codigo } },
        update: {},
        create: {
          tenantId,
          agenteId,
          codigo: t.codigo,
          cliente: t.cliente,
          fecha: new Date(Date.UTC(2026, t.mes - 1, 10)),
          direccion: t.direccion,
          tipoOperacion: 'venta',
          tipoPropiedad: t.tipoPropiedad,
          supCubierta: t.cubierta,
          supSemicubierta: t.semicubierta,
          supDescubierta: t.descubierta,
          superficieTotal: superficieTotal({
            cubierta: t.cubierta,
            semicubierta: t.semicubierta,
            descubierta: t.descubierta,
          }),
          estado: t.estado,
          exclusividad: t.exclusividad,
          motivoNoCaptada: t.motivoNoCaptada,
        },
      });
      tasOk += 1;
    }
    console.log(`Seed Tasador OK — ${tasOk} tasaciones de ejemplo`);
  }

  console.log(
    `Seed OK — tenant "${tenant.slug}" (${tenantId}) · ` +
      `${DATA.vendedores.length} vendedores · ${ventasOk} ventas · ${alqOk} alquileres`,
  );
}

main()
  .catch((e: unknown) => {
    console.error('Seed falló:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
