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
      valorRecomendado?: number;
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

      // --- 20 registros extra (pedido explícito del usuario) — concentrados
      // en junio/julio para poder probar "Este mes"/"Este trimestre" y el
      // gráfico mensual con datos recientes, repartidos entre vendedores. ---
      { codigo: 'TAS-2026-010', cliente: 'Lucía Fernández', direccion: 'Córdoba 1250, Piso 6°', tipoPropiedad: 'Departamento', mes: 6, cubierta: 62, semicubierta: 0, descubierta: 0, estado: 'En proceso', valorRecomendado: 108000 },
      { codigo: 'TAS-2026-011', cliente: 'Martín Gómez', direccion: 'Salta 3400', tipoPropiedad: 'Casa', mes: 6, cubierta: 160, semicubierta: 20, descubierta: 200, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 60 }, valorRecomendado: 195000 },
      { codigo: 'TAS-2026-012', cliente: 'Paula Ríos', direccion: 'Mitre 850, Piso 3°', tipoPropiedad: 'Departamento', mes: 6, cubierta: 3, semicubierta: 0, descubierta: 0, estado: 'No captada', motivoNoCaptada: 'Documentación incompleta', valorRecomendado: 420 },
      { codigo: 'TAS-2026-013', cliente: 'Sofía Duarte', direccion: 'Bv. Oroño 1580, Piso 8°', tipoPropiedad: 'Departamento', mes: 6, cubierta: 105, semicubierta: 8, descubierta: 10, estado: 'Captada', exclusividad: { tipo: 'no' }, valorRecomendado: 152000 },
      { codigo: 'TAS-2026-014', cliente: 'Diego Peralta', direccion: 'San Martín 740', tipoPropiedad: 'Local', mes: 6, cubierta: 85, semicubierta: 0, descubierta: 0, estado: 'No captada', motivoNoCaptada: 'Desacuerdo de precio', valorRecomendado: 240000 },
      { codigo: 'TAS-2026-015', cliente: 'Julián Pérez', direccion: 'Pellegrini 1650, Piso 4°', tipoPropiedad: 'Departamento', mes: 6, cubierta: 58, semicubierta: 0, descubierta: 5, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 45 }, valorRecomendado: 132000 },
      { codigo: 'TAS-2026-016', cliente: 'Camila Torres', direccion: 'Entre Ríos 890', tipoPropiedad: 'PH', mes: 7, cubierta: 72, semicubierta: 12, descubierta: 18, estado: 'En proceso', valorRecomendado: 118000 },
      { codigo: 'TAS-2026-017', cliente: 'Rodrigo Suárez', direccion: 'Av. Pellegrini 2400', tipoPropiedad: 'Departamento', mes: 7, cubierta: 50, semicubierta: 0, descubierta: 0, estado: 'Presentada', valorRecomendado: 96000 },
      { codigo: 'TAS-2026-018', cliente: 'Ana Belén Ortiz', direccion: 'Rioja 1120', tipoPropiedad: 'Casa', mes: 7, cubierta: 140, semicubierta: 15, descubierta: 250, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 90 }, valorRecomendado: 210000 },
      { codigo: 'TAS-2026-019', cliente: 'Franco Molina', direccion: 'Balcarce 3300', tipoPropiedad: 'Oficina', mes: 7, cubierta: 45, semicubierta: 0, descubierta: 0, estado: 'No captada', motivoNoCaptada: 'Ya no quiere vender', valorRecomendado: 85000 },
      { codigo: 'TAS-2026-020', cliente: 'Yamila Acosta', direccion: 'Moreno 780', tipoPropiedad: 'PH', mes: 7, cubierta: 68, semicubierta: 10, descubierta: 12, estado: 'Presentada', valorRecomendado: 121000 },
      { codigo: 'TAS-2026-021', cliente: 'Ezequiel Navarro', direccion: 'San Lorenzo 2200', tipoPropiedad: 'Departamento', mes: 7, cubierta: 39, semicubierta: 0, descubierta: 0, estado: 'Captada', exclusividad: { tipo: 'no' }, valorRecomendado: 78000 },
      { codigo: 'TAS-2026-022', cliente: 'Brenda Vega', direccion: 'Corrientes 4550', tipoPropiedad: 'Departamento', mes: 7, cubierta: 55, semicubierta: 0, descubierta: 6, estado: 'En proceso', valorRecomendado: 102000 },
      { codigo: 'TAS-2026-023', cliente: 'Ignacio Bravo', direccion: 'Urquiza 1980', tipoPropiedad: 'Casa', mes: 7, cubierta: 175, semicubierta: 20, descubierta: 280, estado: 'Presentada', valorRecomendado: 265000 },
      { codigo: 'TAS-2026-024', cliente: 'Milagros Cano', direccion: 'Sarmiento 610', tipoPropiedad: 'Local', mes: 5, cubierta: 60, semicubierta: 0, descubierta: 0, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 30 }, valorRecomendado: 148000 },
      { codigo: 'TAS-2026-025', cliente: 'Tomás Ledesma', direccion: 'Belgrano 2050', tipoPropiedad: 'Departamento', mes: 4, cubierta: 47, semicubierta: 0, descubierta: 0, estado: 'No captada', motivoNoCaptada: 'Desacuerdo de precio', valorRecomendado: 91000 },
      { codigo: 'TAS-2026-026', cliente: 'Agustina Rey', direccion: 'Av. Alberdi 3100', tipoPropiedad: 'PH', mes: 3, cubierta: 82, semicubierta: 8, descubierta: 14, estado: 'Captada', exclusividad: { tipo: 'no' }, valorRecomendado: 137000 },
      { codigo: 'TAS-2026-027', cliente: 'Bruno Aguirre', direccion: 'Catamarca 1770', tipoPropiedad: 'Departamento', mes: 2, cubierta: 41, semicubierta: 0, descubierta: 0, estado: 'En proceso', valorRecomendado: 74000 },
      { codigo: 'TAS-2026-028', cliente: 'Florencia Paz', direccion: 'Av. Francia 450', tipoPropiedad: 'Casa', mes: 6, cubierta: 190, semicubierta: 25, descubierta: 320, estado: 'Presentada', valorRecomendado: 285000 },
      { codigo: 'TAS-2026-029', cliente: 'Gastón Farías', direccion: 'Tucumán 2890', tipoPropiedad: 'Oficina', mes: 7, cubierta: 33, semicubierta: 0, descubierta: 0, estado: 'Captada', exclusividad: { tipo: 'exclusiva', dias: 60 }, valorRecomendado: 63000 },
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
          valorRecomendado: t.valorRecomendado,
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
