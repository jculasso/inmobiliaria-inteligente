import { randomUUID } from 'node:crypto';
import { it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { levantarApi, ok, urlLocal, type Api } from './harness';

/**
 * Siembra una cartera del tamaño de Vacker en una base LOCAL, por la API real
 * (los mismos servicios, la misma imputación, las mismas liquidaciones): 120
 * contratos, ~300 personas y dos años de historia —generación mensual, cobros
 * puntuales, tardíos, parciales y morosos, liquidaciones, boletas, reclamos
 * con comprobantes, reservas con seña y liquidaciones parciales y finales—. Y
 * una segunda inmobiliaria más chica, para que RLS filtre de verdad.
 *
 * Datos inventados: nombres, documentos y direcciones salen de listas fijas.
 * Lo único que se escribe por fuera de la API es lo que no tiene pantalla
 * (inmobiliaria, usuario, valores de índices, feriados) y el importe de los
 * tramos ya indexados en el pasado.
 */

const HOY = '2026-10-15';
const PRIMER_MES = '2024-10';

// --- Azar reproducible ---------------------------------------------------------
let semilla = 20261015;
function azar(): number {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => a + Math.floor(azar() * (b - a + 1));
const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(azar() * xs.length)]!;

// --- Fechas ---------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');
function sumarMeses(iso: string, n: number): string {
  const [a, m] = iso.split('-').map(Number) as [number, number];
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}${iso.length > 7 ? iso.slice(7) : ''}`;
}
function menosUnDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
const mesDe = (iso: string) => iso.slice(0, 7);
function meses(desde: string, hasta: string): string[] {
  const r: string[] = [];
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) r.push(m);
  return r;
}

// --- Nombres inventados -----------------------------------------------------------
const NOMBRES = [
  'Lucía',
  'Martín',
  'Sofía',
  'Joaquín',
  'Valentina',
  'Tomás',
  'Camila',
  'Mateo',
  'Julieta',
  'Benjamín',
  'Agustina',
  'Santiago',
  'Florencia',
  'Nicolás',
  'Micaela',
  'Facundo',
  'Rocío',
  'Ignacio',
  'Carolina',
  'Gonzalo',
];
const APELLIDOS = [
  'Prueba',
  'Ensayo',
  'Ficticio',
  'Inventado',
  'Ejemplar',
  'Muestra',
  'Simulado',
  'Modelo',
  'Borrador',
  'Maqueta',
  'Boceto',
  'Esbozo',
  'Plantilla',
  'Testigo',
  'Patrón',
];
const CALLES = [
  'Calle Falsa',
  'Av. Imaginaria',
  'Pasaje Supuesto',
  'Bv. Hipotético',
  'Calle Ficción',
  'Av. Ejemplo',
  'Calle Demo',
  'Diagonal Ensayo',
];

interface ContratoPlan {
  id: string;
  codigo: string;
  tipo: 'vivienda' | 'comercial';
  moneda: 'ARS' | 'USD';
  inicio: string;
  fin: string;
  inquilinos: string[];
  propietarios: string[];
  /** Los meses en que la cuenta del inquilino se paga. */
  perfil: 'puntual' | 'tardio' | 'parcial' | 'moroso' | 'incobrable';
  final: 'vigente' | 'finalizado' | 'rescindido';
  rescindidoEl?: string;
}

async function base(db: PrismaClient, nombre: string, slug: string) {
  const tenantId = randomUUID();
  const usuarioId = randomUUID();
  const authUserId = randomUUID();
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre,
      slug,
      plan: 'profesional',
      modulos: {
        tablero: true,
        tasador: true,
        todo: false,
        protocolo: true,
        publicacion: false,
        alquileres: true,
      },
    },
  });
  await db.usuario.create({
    data: {
      id: usuarioId,
      tenantId,
      nombre: `Administración ${nombre}`,
      email: `admin-${slug}@ejemplo.test`,
      authUserId,
      debeCambiarPassword: false,
    },
  });
  await db.usuarioRol.create({ data: { usuarioId, tenantId, rol: 'admin_tenant' } });
  return { tenantId, usuarioId, authUserId };
}

/** ICL diario y IPC mensual inventados, con una inflación del 2,5 % mensual. */
async function indices(db: PrismaClient) {
  await db.indiceValor.deleteMany({});
  const filas: { indice: string; fecha: Date; valor: number; fuente: string }[] = [];
  let icl = 1;
  for (
    let d = new Date('2021-01-01T00:00:00Z');
    d.toISOString().slice(0, 10) < HOY;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    icl *= 1.00082;
    filas.push({
      indice: 'ICL',
      fecha: new Date(d),
      valor: Number(icl.toFixed(6)),
      fuente: 'perf',
    });
  }
  let ipc = 100;
  // El IPC de setiembre todavía no salió: las indexaciones de octubre por IPC
  // quedan esperando (liquidación parcial, regla 130).
  for (const m of meses('2021-01', '2026-08')) {
    ipc *= 1.025;
    filas.push({
      indice: 'IPC',
      fecha: new Date(`${m}-01T00:00:00Z`),
      valor: Number(ipc.toFixed(6)),
      fuente: 'perf',
    });
  }
  await db.indiceValor.createMany({ data: filas });
  await db.feriado.deleteMany({});
  const feriados = [
    '2024-11-18',
    '2024-12-25',
    '2025-01-01',
    '2025-03-03',
    '2025-03-04',
    '2025-03-24',
    '2025-04-02',
    '2025-04-18',
    '2025-05-01',
    '2025-05-02',
    '2025-05-25',
    '2025-06-16',
    '2025-06-20',
    '2025-07-09',
    '2025-08-15',
    '2025-10-10',
    '2025-11-21',
    '2025-12-08',
    '2025-12-25',
    '2026-01-01',
    '2026-02-16',
    '2026-02-17',
    '2026-03-24',
    '2026-04-02',
    '2026-04-03',
    '2026-05-01',
    '2026-05-25',
    '2026-06-15',
    '2026-06-20',
    '2026-07-09',
    '2026-08-17',
    '2026-10-12',
    '2026-11-23',
    '2026-12-08',
    '2026-12-25',
  ];
  await db.feriado.createMany({
    data: feriados.map((f) => ({
      fecha: new Date(`${f}T00:00:00Z`),
      nombre: 'Feriado de prueba',
      tipo: 'inamovible',
      fuente: 'perf',
    })),
  });
}

interface Cartera {
  contratos: ContratoPlan[];
  propietarios: string[];
  inquilinos: string[];
  propiedadesLibres: string[];
  interesados: string[];
}

/** Las personas, las propiedades y los contratos, por la API. */
async function cartera(
  api: Api,
  db: PrismaClient,
  tenantId: string,
  n: number,
  docBase: number,
): Promise<Cartera> {
  let doc = docBase;
  const persona = async (papel: string) => {
    const r = await api.pedir('POST', '/alquileres/personas', {
      nombre: `${elegir(NOMBRES)} ${elegir(APELLIDOS)} (${papel} ${doc - docBase + 1})`,
      documento: String(doc++),
      email: `persona${doc}@ejemplo.test`,
      telefono: `11-5555-${String(doc % 10000).padStart(4, '0')}`,
      domicilio: `${elegir(CALLES)} ${entre(100, 9000)}`,
    });
    return ok<{ id: string }>(r, 'persona').id;
  };
  const nProp = Math.round(n * 0.8);
  const propietarios: string[] = [];
  for (let i = 0; i < nProp; i++) propietarios.push(await persona('propietario'));
  const garantes: string[] = [];
  for (let i = 0; i < Math.round(n * 0.65); i++) garantes.push(await persona('garante'));
  const interesados: string[] = [];
  for (let i = 0; i < Math.max(2, Math.round(n * 0.05)); i++)
    interesados.push(await persona('interesado'));

  const propiedades: string[] = [];
  for (let i = 0; i < n + Math.max(3, Math.round(n * 0.08)); i++) {
    const r = await api.pedir('POST', '/alquileres/propiedades', {
      direccion: `${elegir(CALLES)} ${entre(100, 9000)}`,
      unidad: azar() < 0.5 ? `${entre(1, 12)}° ${elegir(['A', 'B', 'C', 'D'])}` : null,
      ciudad: 'Ciudad de Prueba',
      tipo: i % 4 === 3 ? 'local' : 'vivienda',
    });
    propiedades.push(ok<{ id: string }>(r, 'propiedad').id);
  }

  // Un propietario con seis propiedades, cinco con tres, el resto con una o dos.
  const duenios: string[] = [];
  duenios.push(...Array(6).fill(propietarios[0]));
  for (let i = 1; i <= 5; i++) duenios.push(...Array(3).fill(propietarios[i]));
  for (let i = 6; duenios.length < n; i = i + 1 >= propietarios.length ? 6 : i + 1)
    duenios.push(propietarios[i]!);

  const contratos: ContratoPlan[] = [];
  const inquilinos: string[] = [];
  for (let i = 0; i < n; i++) {
    const tipo: ContratoPlan['tipo'] = i % 4 === 3 ? 'comercial' : 'vivienda';
    const moneda: ContratoPlan['moneda'] = i % 15 === 7 ? 'USD' : 'ARS';
    const tomadoEnCurso = i % 12 === 5;
    const finalizado = i % 8 === 2;
    const rescindido = i % 40 === 11;
    // Inicio: los finalizados empezaron antes; el resto, repartidos.
    const duracion = tipo === 'comercial' || tomadoEnCurso ? 36 : elegir([24, 36]);
    let inicio: string;
    if (tomadoEnCurso) inicio = `${elegir(['2024-03', '2024-06', '2024-09'])}-01`;
    else if (finalizado)
      inicio = `${sumarMeses(`2024-${pad(entre(1, 9))}`, -duracion + entre(4, 22))}-01`;
    else inicio = `${sumarMeses('2023-11', entre(0, 34))}-01`;
    if (!finalizado && !tomadoEnCurso && sumarMeses(inicio, duracion) <= '2026-11')
      inicio = `${sumarMeses('2026-11', -duracion + entre(1, 12))}-01`;
    const fin = menosUnDia(sumarMeses(inicio, duracion));
    const administradoDesde = tomadoEnCurso ? '2025-02-01' : null;

    const ajuste = moneda === 'USD' || i % 10 === 4 ? 'escalonado' : 'indexado';
    const indice =
      ajuste === 'indexado' ? (i % 40 === 9 ? 'CCP' : i % 2 === 0 ? 'ICL' : 'IPC') : null;
    const per =
      ajuste === 'escalonado'
        ? moneda === 'USD'
          ? 12
          : 6
        : indice === 'ICL'
          ? elegir([6, 12])
          : indice === 'IPC'
            ? elegir([3, 4, 6])
            : 6;
    const importe = moneda === 'USD' ? entre(4, 15) * 100 : entre(25, 120) * 10_000;

    const tramos: { numero: number; desde: string; hasta: string; importe: number | null }[] = [];
    let valor = importe;
    for (let k = 0, d = inicio; d <= fin; k++, d = sumarMeses(d, per)) {
      const hasta = sumarMeses(d, per) > fin ? fin : menosUnDia(sumarMeses(d, per));
      const vigenteAlTomar =
        administradoDesde && d <= administradoDesde && hasta >= administradoDesde;
      tramos.push({
        numero: k + 1,
        desde: d,
        hasta,
        importe: ajuste === 'escalonado' || k === 0 || vigenteAlTomar ? Math.round(valor) : null,
      });
      valor *= ajuste === 'escalonado' ? (moneda === 'USD' ? 1.05 : 1.15) : 1 + 0.025 * per;
    }
    // Con «administrado desde», el primer tramo puede quedar sin importe.
    if (administradoDesde && ajuste === 'indexado') {
      const vig = tramos.find((t) => t.desde <= administradoDesde && t.hasta >= administradoDesde)!;
      for (const t of tramos) if (t.numero < vig.numero) t.importe = null;
    }

    const inq = [await persona('inquilino')];
    if (i % 20 === 13) inq.push(await persona('inquilino'));
    inquilinos.push(...inq);
    const duenio = duenios[i]!;
    const coDuenio =
      i % 7 === 3 ? propietarios[(propietarios.indexOf(duenio) + 17) % propietarios.length]! : null;
    const partes = [
      ...inq.map((personaId) => ({ personaId, papel: 'inquilino' })),
      { personaId: duenio, papel: 'propietario', porcentaje: coDuenio ? 50 : 100 },
      ...(coDuenio ? [{ personaId: coDuenio, papel: 'propietario', porcentaje: 50 }] : []),
      { personaId: garantes[i % garantes.length]!, papel: 'garante' },
    ];
    const r = await api.pedir('POST', '/alquileres/contratos', {
      propiedadId: propiedades[i]!,
      tipo,
      moneda,
      inicio,
      fin,
      fechaFirma: menosUnDia(inicio),
      diaVencimiento: elegir([5, 5, 5, 10]),
      diaPagoPropietario: 10,
      ajuste,
      indice,
      periodicidadMeses: ajuste === 'indexado' ? per : null,
      honorariosPct: elegir([4, 5, 6]),
      gastosAdmPct: elegir([0, 2]),
      ivaPct: tipo === 'comercial' ? 21 : 0,
      punitorioDiarioPct: 0.3,
      pagoGarantizado: i % 9 === 0,
      administradoDesde,
      depositoImporte: importe,
      depositoMoneda: moneda,
      partes,
      tramos,
    });
    const c = ok<{ id: string; codigo: string }>(r, `contrato ${i}`);
    ok(
      await api.pedir('POST', `/alquileres/contratos/${c.id}/estado`, { estado: 'vigente' }),
      'vigente',
    );

    // Los tramos indexados que ya empezaron: el importe que alguien confirmó en
    // su momento. No tiene sentido rehacer dos años de bandeja por la API.
    if (ajuste === 'indexado') {
      let v = importe;
      const ts = await db.alqTramo.findMany({
        where: { contratoId: c.id },
        orderBy: { numero: 'asc' },
      });
      for (const t of ts) {
        const desde = t.desde.toISOString().slice(0, 10);
        if (t.importe != null) v = Number(t.importe);
        else if (desde <= '2026-09-30') {
          await db.alqTramo.update({
            where: { id: t.id },
            data: { importe: Math.round(v), confirmadoEl: new Date(`${desde}T12:00:00Z`) },
          });
        }
        v *= 1 + 0.025 * per;
      }
    }

    const perfil: ContratoPlan['perfil'] =
      i % 25 === 17
        ? 'incobrable'
        : i % 13 === 6
          ? 'moroso'
          : i % 11 === 8
            ? 'parcial'
            : i % 5 === 1
              ? 'tardio'
              : 'puntual';
    contratos.push({
      id: c.id,
      codigo: c.codigo,
      tipo,
      moneda,
      inicio: administradoDesde ?? inicio,
      fin,
      inquilinos: inq,
      propietarios: coDuenio ? [duenio, coDuenio] : [duenio],
      perfil,
      final: rescindido ? 'rescindido' : fin < '2026-10-01' ? 'finalizado' : 'vigente',
      rescindidoEl: rescindido ? `${sumarMeses('2025-06', entre(0, 10))}-20` : undefined,
    });
  }
  void tenantId;
  return {
    contratos,
    propietarios: [...new Set(duenios.concat(contratos.flatMap((c) => c.propietarios)))],
    inquilinos,
    propiedadesLibres: propiedades.slice(n),
    interesados,
  };
}

const sumar = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

/** Un mes de cobros: cada inquilino según su perfil. */
async function cobrosDelMes(api: Api, cartera: Cartera, mes: string, ultimo: boolean) {
  for (const c of cartera.contratos) {
    if (mes < mesDe(c.inicio) || mes > mesDe(c.fin)) continue;
    if (c.rescindidoEl && mes > mesDe(c.rescindidoEl)) continue;
    const perfil = c.perfil;
    const n = meses(PRIMER_MES, mes).length;
    if (perfil === 'incobrable' && mes >= '2026-06') continue;
    if (perfil === 'moroso' && n % 6 >= 3 && n % 6 <= 4) continue; // dos meses sin pagar de cada seis
    let dia =
      perfil === 'tardio' ? entre(12, 26) : perfil === 'puntual' ? entre(1, 9) : entre(5, 20);
    if (ultimo) dia = Math.min(dia, 14);
    const fecha = `${mes}-${pad(dia)}`;
    for (const personaId of c.inquilinos.slice(0, 1)) {
      const prep = ok<{
        deudas: {
          conceptoId: string;
          vencimiento: string;
          saldo: number;
          punitorio: { importe: number } | null;
        }[];
      }>(
        await api.pedir(
          'GET',
          `/alquileres/cobros/preparar?personaId=${personaId}&moneda=${c.moneda}&fecha=${fecha}`,
        ),
        'preparar cobro',
      );
      const aPagar = prep.deudas.filter((d) => d.vencimiento <= `${mes}-31` && d.saldo > 0);
      if (!aPagar.length) continue;
      const conPunitorio = perfil === 'tardio' || perfil === 'moroso';
      const punitorios = conPunitorio
        ? aPagar
            .filter((d) => d.punitorio && d.punitorio.importe > 0)
            .map((d) => ({ conceptoId: d.conceptoId, importe: d.punitorio!.importe }))
        : [];
      let importe = sumar(aPagar.map((d) => d.saldo).concat(punitorios.map((p) => p.importe)));
      if (perfil === 'parcial' || (perfil === 'incobrable' && n % 2 === 0))
        importe = Math.round(importe * 0.6 * 100) / 100;
      if (importe <= 0) continue;
      const r = await api.pedir('POST', '/alquileres/cobros', {
        personaId,
        fecha,
        moneda: c.moneda,
        importe,
        medio: elegir(['transferencia', 'transferencia', 'efectivo', 'cheque']),
        conceptoIds: perfil === 'parcial' ? null : aPagar.map((d) => d.conceptoId),
        punitorios,
      });
      if (r.status >= 300)
        console.warn('cobro', c.codigo, fecha, JSON.stringify(r.json).slice(0, 300));
    }
  }
}

async function liquidacionesDelMes(api: Api, cartera: Cartera, mes: string, ultimo: boolean) {
  const fecha = `${mes}-${ultimo ? '14' : pad(entre(11, 16))}`;
  const monedas = new Map<string, Set<string>>();
  for (const c of cartera.contratos) {
    if (mes < mesDe(c.inicio)) continue;
    for (const p of c.propietarios) {
      if (!monedas.has(p)) monedas.set(p, new Set());
      monedas.get(p)!.add(c.moneda);
    }
  }
  for (const [personaId, ms] of monedas) {
    for (const moneda of ms) {
      const prep = ok<{ aPagar: unknown[]; neto: number }>(
        await api.pedir(
          'GET',
          `/alquileres/liquidaciones/preparar?personaId=${personaId}&moneda=${moneda}&fecha=${fecha}`,
        ),
        'preparar liquidación',
      );
      if (!prep.aPagar.length || prep.neto <= 0) continue;
      const r = await api.pedir('POST', '/alquileres/liquidaciones', {
        personaId,
        moneda,
        fecha,
        medio: 'transferencia',
      });
      if (r.status >= 300)
        console.warn('liquidación', personaId, fecha, JSON.stringify(r.json).slice(0, 300));
    }
  }
}

interface Impuestos {
  cuentas: { id: string; importe: number }[];
}

async function prepararImpuestos(api: Api, cartera: Cartera, n: number): Promise<Impuestos> {
  const servicio = async (nombre: string, clase: string) =>
    ok<{ id: string }>(
      await api.pedir('POST', '/alquileres/servicios', { nombre, clase }),
      'servicio',
    ).id;
  const abl = await servicio('ABL de prueba', 'impuesto');
  const inmob = await servicio('Inmobiliario de prueba', 'impuesto');
  const exp = await servicio('Expensas de prueba', 'expensa');
  const contratosPorPropiedad = ok<{ id: string; propiedad: { id: string } }[]>(
    await api.pedir('GET', '/alquileres/contratos'),
    'contratos',
  );
  const props = [
    ...new Set(contratosPorPropiedad.map((c) => c.propiedad?.id).filter(Boolean)),
  ] as string[];
  const cuentas: Impuestos['cuentas'] = [];
  const cuenta = async (
    propiedadId: string,
    servicioId: string,
    aCargoDe: string,
    paga: string,
    importe: number,
  ) => {
    const r = await api.pedir('POST', '/alquileres/cuentas-servicio', {
      propiedadId,
      servicioId,
      numeroCuenta: String(entre(100000, 999999)),
      aCargoDe,
      paga,
    });
    cuentas.push({ id: ok<{ id: string }>(r, 'cuenta').id, importe });
  };
  for (const [i, p] of props.slice(0, Math.round(n / 2)).entries()) {
    await cuenta(
      p,
      abl,
      'inquilino',
      i % 3 === 0 ? 'inquilino' : 'inmobiliaria',
      entre(15, 60) * 1000,
    );
    await cuenta(p, inmob, 'propietario', 'inmobiliaria', entre(10, 40) * 1000);
    if (i % 3 === 1) await cuenta(p, exp, 'inquilino', 'inquilino', entre(60, 200) * 1000);
  }
  void cartera;
  return { cuentas };
}

async function boletasDelMes(api: Api, imp: Impuestos, mes: string, ultimo: boolean) {
  const r = await api.pedir('POST', '/alquileres/boletas/lote', {
    periodo: mes,
    boletas: imp.cuentas.map((c) => ({
      cuentaId: c.id,
      cuota: null,
      vencimiento: `${mes}-15`,
      importe: c.importe,
    })),
  });
  ok(r, 'lote de boletas');
  for (const c of imp.cuentas) c.importe = Math.round(c.importe * 1.03);
  if (ultimo) return;
  const boletas = ok<{ id: string; paga: string; estado: string }[]>(
    await api.pedir('GET', `/alquileres/boletas?periodo=${mes}`),
    'boletas',
  );
  for (const b of boletas.filter((x) => x.paga === 'inmobiliaria' && x.estado === 'pendiente')) {
    const p = await api.pedir('POST', `/alquileres/boletas/${b.id}/pagar`, {
      fecha: `${mes}-14`,
      medio: 'transferencia',
    });
    if (p.status >= 300) console.warn('boleta', JSON.stringify(p.json).slice(0, 200));
  }
}

async function reclamosDelMes(api: Api, cartera: Cartera, proveedores: string[], mes: string) {
  for (let k = 0; k < 3; k++) {
    const c = elegir(
      cartera.contratos.filter((x) => mesDe(x.inicio) <= mes && mesDe(x.fin) >= mes),
    );
    if (!c) continue;
    const r = ok<{ id: string }>(
      await api.pedir('POST', '/alquileres/reclamos', {
        asunto: elegir([
          'Pérdida de agua en el baño',
          'No anda el termotanque',
          'Humedad en la pared',
          'Persiana trabada',
          'Consulta por la expensa',
        ]),
        descripcion: 'Reclamo inventado para la prueba de volumen.',
        tipo: elegir(['mantenimiento', 'mantenimiento', 'administrativo']),
        prioridad: elegir(['baja', 'media', 'alta']),
        contratoId: c.id,
        proveedorId: elegir(proveedores),
      }),
      'reclamo',
    );
    if (azar() < 0.6) {
      const g = await api.pedir('POST', '/alquileres/comprobantes', {
        proveedorId: elegir(proveedores),
        contratoId: c.id,
        fecha: `${mes}-${pad(entre(2, 12))}`,
        tipoComprobante: 'factura_c',
        numero: `0001-${entre(10000, 99999)}`,
        descripcion: 'Arreglo del reclamo',
        importe: entre(20, 250) * 1000,
        moneda: c.moneda,
        aCargoDe: azar() < 0.8 ? 'propietario' : 'inquilino',
        reclamoId: r.id,
        pagado: true,
        medio: 'transferencia',
      });
      if (g.status >= 300) console.warn('comprobante', JSON.stringify(g.json).slice(0, 300));
      await api.pedir('PATCH', `/alquileres/reclamos/${r.id}`, {
        estado: 'resuelto',
        nota: 'Arreglado.',
      });
    } else if (azar() < 0.5) {
      await api.pedir('PATCH', `/alquileres/reclamos/${r.id}`, {
        estado: 'en_curso',
        nota: 'Se llamó al proveedor.',
      });
    }
  }
}

async function historia(
  api: Api,
  cart: Cartera,
  desde: string,
  hasta: string,
  imp: Impuestos | null,
  proveedores: string[],
) {
  for (const mes of meses(desde, hasta)) {
    const t0 = performance.now();
    const ultimo = mes === mesDe(HOY);
    ok(
      await api.pedir('POST', '/alquileres/conceptos/generar', { periodo: mes }),
      `generar ${mes}`,
    );
    if (imp) await boletasDelMes(api, imp, mes, ultimo);
    if (proveedores.length) await reclamosDelMes(api, cart, proveedores, mes);
    await cobrosDelMes(api, cart, mes, ultimo);
    await liquidacionesDelMes(api, cart, mes, ultimo);
    // Los contratos que terminaron o se rescindieron este mes.
    for (const c of cart.contratos) {
      if (c.final === 'finalizado' && mesDe(c.fin) === mes) {
        await api.pedir('POST', `/alquileres/contratos/${c.id}/estado`, { estado: 'finalizado' });
      }
      if (c.final === 'rescindido' && mesDe(c.rescindidoEl!) === mes) {
        const r = await api.pedir('POST', `/alquileres/contratos/${c.id}/estado`, {
          estado: 'rescindido',
          fecha: c.rescindidoEl,
        });
        if (r.status >= 300) console.warn('rescindir', JSON.stringify(r.json).slice(0, 300));
      }
    }
    console.log(`  ${mes} listo en ${Math.round(performance.now() - t0)} ms`);
  }
}

it('siembra la cartera de prueba', async () => {
  const db = new PrismaClient({ datasourceUrl: urlLocal() });
  await db.$connect();
  // Base local y descartable (lo garantiza `urlLocal`): una siembra a medias
  // se borra entera y se empieza de nuevo.
  await db.tenant.deleteMany({ where: { slug: { in: ['vacker-de-prueba', 'otra-de-prueba'] } } });
  await indices(db);
  const vacker = await base(db, 'Vacker de prueba', 'vacker-de-prueba');
  const otra = await base(db, 'Otra Inmobiliaria de prueba', 'otra-de-prueba');
  let token = vacker.authUserId;
  const api = await levantarApi(() => token);
  try {
    // --- La otra inmobiliaria: chica, seis meses de historia ---------------------
    token = otra.authUserId;
    const cartOtra = await cartera(api, db, otra.tenantId, 20, 30_000_000);
    await historia(api, cartOtra, '2026-04', mesDe(HOY), null, []);

    // --- Vacker de prueba ---------------------------------------------------------
    token = vacker.authUserId;
    console.log('Vacker: personas, propiedades y contratos…');
    const cart = await cartera(api, db, vacker.tenantId, 120, 20_000_000);
    const imp = await prepararImpuestos(api, cart, 120);
    const proveedores: string[] = [];
    for (const [nombre, rubro] of [
      ['Plomería de prueba', 'plomero'],
      ['Electricidad de prueba', 'electricista'],
      ['Pinturas de prueba', 'pintor'],
      ['Cerrajería de prueba', 'cerrajero'],
      ['Gas de prueba', 'gasista'],
      ['Mantenimiento general', 'otro'],
    ] as const) {
      const r = await api.pedir('POST', '/alquileres/proveedores', { nombre, rubro });
      if (r.status < 300) proveedores.push((r.json as { id: string }).id);
      else console.warn('proveedor', JSON.stringify(r.json).slice(0, 200));
    }
    await historia(api, cart, PRIMER_MES, mesDe(HOY), imp, proveedores);

    // --- Parciales y finales: sale el IPC de setiembre y se confirman --------------
    await db.indiceValor.create({
      data: { indice: 'IPC', fecha: new Date('2026-09-01T00:00:00Z'), valor: 999, fuente: 'perf' },
    });
    const ipcAgo = await db.indiceValor.findUnique({
      where: { indice_fecha: { indice: 'IPC', fecha: new Date('2026-08-01T00:00:00Z') } },
    });
    await db.indiceValor.update({
      where: { indice_fecha: { indice: 'IPC', fecha: new Date('2026-09-01T00:00:00Z') } },
      data: { valor: Number(ipcAgo!.valor) * 1.03 },
    });
    const bandeja = ok<{
      tramos: { tramoId?: string; id?: string; estado: string; desde: string }[];
    }>(await api.pedir('GET', '/alquileres/indexaciones'), 'bandeja');
    let confirmadas = 0;
    for (const t of bandeja.tramos.filter((x) => x.estado === 'lista' && x.desde <= HOY)) {
      const id = t.tramoId ?? t.id;
      const r = await api.pedir('POST', `/alquileres/indexaciones/${id}/confirmar`, {});
      if (r.status < 300) confirmadas++;
      else console.warn('confirmar', JSON.stringify(r.json).slice(0, 300));
    }
    console.log(`Indexaciones confirmadas después de la parcial: ${confirmadas}`);
    ok(
      await api.pedir('POST', '/alquileres/conceptos/generar', { periodo: mesDe(HOY) }),
      'generar de nuevo',
    );

    // --- Reservas con seña -----------------------------------------------------------
    for (const [i, propiedadId] of cart.propiedadesLibres.slice(0, 6).entries()) {
      const r = await api.pedir('POST', '/alquileres/reservas', {
        propiedadId,
        fecha: `2026-10-${pad(2 + i)}`,
        vence: `2026-10-${pad(20 + i)}`,
        partes: [
          { personaId: cart.interesados[i % cart.interesados.length]!, papel: 'inquilino' },
          {
            personaId: cart.propietarios[(i * 7) % cart.propietarios.length]!,
            papel: 'propietario',
          },
        ],
        senaImporte: 300_000,
        tipo: 'vivienda',
        moneda: 'ARS',
        alquilerInicial: 600_000,
        inicio: '2026-11-01',
        duracionMeses: 24,
        ajuste: 'indexado',
        indice: 'ICL',
        periodicidadMeses: 6,
        depositoImporte: 600_000,
      });
      const reserva = ok<{ id: string }>(r, 'reserva');
      if (i < 4) {
        const s = await api.pedir('POST', `/alquileres/reservas/${reserva.id}/sena`, {
          fecha: `2026-10-${pad(3 + i)}`,
          medio: 'transferencia',
        });
        if (s.status >= 300) console.warn('seña', JSON.stringify(s.json).slice(0, 300));
      }
    }

    // --- Plantilla de contrato en Word (el ejemplo de la propia API) ------------------
    const ej = await fetch(
      `http://127.0.0.1:${(api.app.getHttpServer().address() as { port: number }).port}/alquileres/plantillas/ejemplo`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const docx = Buffer.from(await ej.arrayBuffer());
    const p = await api.subir(
      '/alquileres/plantillas',
      { nombre: 'Contrato de prueba', documento: 'contrato' },
      docx,
      'contrato.docx',
    );
    if (p.status >= 300) console.warn('plantilla', JSON.stringify(p.json).slice(0, 400));

    const cuenta = async (t: string) =>
      (
        await db.$queryRawUnsafe<{ tabla: string; n: bigint }[]>(
          `SELECT '${t}' AS tabla, count(*) AS n FROM ${t} WHERE tenant_id = '${vacker.tenantId}'`,
        )
      )[0]!;
    for (const t of [
      'alq_persona',
      'alq_contrato',
      'alq_tramo',
      'alq_concepto',
      'alq_cobro',
      'alq_imputacion',
      'alq_liquidacion',
      'alq_boleta',
      'alq_reclamo',
      'alq_comprobante',
      'alq_reserva',
      'alq_evento',
    ]) {
      const r = await cuenta(t);
      console.log(`${r.tabla}: ${r.n}`);
    }
  } finally {
    await api.cerrar();
    await db.$disconnect();
  }
});
