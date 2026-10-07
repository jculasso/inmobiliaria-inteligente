import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DIAS_TABLERO_PROXIMOS,
  ESTADOS_RECLAMO_ABIERTOS,
  NOMBRE_ESTADO_CONTRATO,
  PrioridadReclamoSchema,
  TRAMOS_MORA,
  nombrePrioridad,
  textoCuota,
  type CierreTablero,
  type DetalleTableroQuery,
  type EstadoContrato,
  type FiltroTipoContrato,
  type FilaTablero,
  type Indicador,
  type MonedaAlquiler,
  type ParteIngresos,
  type TableroAlquileresDto,
  type TramoMora,
} from '@vacker/types';
import {
  alquilerDeHoy,
  cierreDelMes,
  diasInclusive,
  proximoCambio,
  redondear2,
  sumarDiasIso,
  sumarMesesIso,
  tramoDeMora,
} from '@vacker/domain';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { plata } from './historial';
import { IndexacionesService } from './indexaciones.service';
import { LiquidacionesService } from './liquidaciones.service';

/** «1 día», «29 días». */
const enDias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

const aContrato = (id: string) => `/alquileres/contratos/${id}`;
const aPersona = (id: string) => `/alquileres/personas/${id}`;

/** Un número que suma sus filas (regla 26): el valor sale de las filas, nunca aparte. */
function porImporte(filas: FilaTablero[]): Indicador {
  return { valor: redondear2(filas.reduce((s, f) => s + (f.importe ?? 0), 0)), filas };
}

function porCantidad(filas: FilaTablero[]): Indicador {
  return { valor: filas.length, filas };
}

const sumar = (xs: number[]) => redondear2(xs.reduce((s, x) => s + x, 0));

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

// --- Lo que se lee de la base ---------------------------------------------------

/** Un alquiler del lado del inquilino, con lo cobrado hasta hoy y al cierre de su mes. */
interface FilaAlquiler {
  id: string;
  periodo: string;
  moneda: string;
  importe: Prisma.Decimal;
  vencimiento: Date;
  descripcion: string | null;
  contrato_id: string | null;
  tipo_contrato: string | null;
  persona_id: string;
  nombre: string;
  cobrado: Prisma.Decimal;
  cobrado_al_cierre: Prisma.Decimal;
}

/** Un concepto con saldo vencido a una fecha de cierre (regla 77). */
interface FilaMora {
  cierre: string;
  id: string;
  moneda: string;
  vencimiento: Date;
  descripcion: string | null;
  tipo: string;
  saldo: Prisma.Decimal;
  contrato_id: string | null;
  codigo: string | null;
  persona_id: string;
  nombre: string;
  tipo_contrato: string | null;
}

/** Un movimiento que es ingreso de la inmobiliaria (regla 30). */
interface MovimientoIngreso {
  id: string;
  fecha: Date;
  moneda: string;
  contrato_id: string;
  tipo_contrato: string | null;
  tipo: string;
  importe: Prisma.Decimal;
  descripcion: string | null;
  persona_id: string;
  nombre: string;
}

/**
 * Los alquileres de los meses `desde`…`hasta` (y, si se pide, uno más suelto),
 * uno por fila. `cobrado` es lo aplicado hasta hoy; `cobrado_al_cierre`, lo
 * aplicado hasta el último día de su mes (regla 29). Las dos sin lo de cobros
 * anulados: el mismo filtro que `IMPUTACION_ACTIVA`, escrito en SQL.
 *
 * Lo leen el tablero, que lo suma por mes, y el detalle, que lo lista: la
 * misma consulta en los dos lados (regla 79).
 */
function sqlAlquileres(desde: string, hasta: string, ademas: string | null = null) {
  return Prisma.sql`
    SELECT k.id, k.periodo, k.moneda, k.importe, k.vencimiento, k.descripcion,
           k.contrato_id, c.tipo AS tipo_contrato, p.id AS persona_id, p.nombre,
           COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL), 0) AS cobrado,
           COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL
                                              AND re.fecha < (to_date(k.periodo, 'YYYY-MM') + INTERVAL '1 month')), 0) AS cobrado_al_cierre
      FROM alq_concepto k
      JOIN alq_persona p ON p.id = k.persona_id
      LEFT JOIN alq_contrato c ON c.id = k.contrato_id
      LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
      LEFT JOIN alq_cobro co ON co.id = im.cobro_id
      LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
     WHERE k.tipo = 'alquiler' AND k.sentido = 'a_cobrar' AND k.anulado_en IS NULL
       AND (k.periodo BETWEEN ${desde} AND ${hasta}${ademas ? Prisma.sql` OR k.periodo = ${ademas}` : Prisma.empty})
     GROUP BY k.id, c.tipo, p.id
     ORDER BY k.vencimiento, k.id`;
}

/**
 * Deuda vencida de inquilinos a cada fecha de `cierres` (reglas 29 y 77): lo
 * vencido antes de esa fecha menos lo cobrado hasta esa fecha, sin cobros
 * anulados. Solo lo que tiene saldo. Lo de un propietario en su contrato se
 * descuenta al liquidar, no es mora.
 *
 * Una sola consulta para todas las fechas: el tablero pide los cierres del
 * año y hoy; el detalle, un cierre.
 */
function sqlSaldosAlCierre(cierres: string[]) {
  return Prisma.sql`
    SELECT * FROM (
      SELECT to_char(x.cierre, 'YYYY-MM-DD') AS cierre, k.id, k.moneda, k.vencimiento, k.descripcion, k.tipo,
             k.importe - COALESCE(SUM(im.importe) FILTER (WHERE co.anulado_en IS NULL AND re.anulado_en IS NULL
                                                           AND re.fecha <= x.cierre), 0) AS saldo,
             c.id AS contrato_id, c.codigo, c.tipo AS tipo_contrato, p.id AS persona_id, p.nombre
        FROM unnest(${cierres}::date[]) AS x(cierre)
        JOIN alq_concepto k ON k.vencimiento < x.cierre
        JOIN alq_persona p ON p.id = k.persona_id
        LEFT JOIN alq_contrato c ON c.id = k.contrato_id
        LEFT JOIN alq_imputacion im ON im.concepto_id = k.id
        LEFT JOIN alq_cobro co ON co.id = im.cobro_id
        LEFT JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id
       WHERE k.sentido = 'a_cobrar' AND k.anulado_en IS NULL AND k.liquidacion_id IS NULL
         AND k.tipo <> 'honorarios'
         AND NOT EXISTS (SELECT 1 FROM alq_contrato_parte pp
                          WHERE pp.contrato_id = k.contrato_id AND pp.persona_id = k.persona_id AND pp.papel = 'propietario')
       GROUP BY x.cierre, k.id, c.id, p.id
    ) s
     WHERE s.saldo > 0
     ORDER BY s.cierre, s.vencimiento, s.id`;
}

/**
 * Regla 30: lo que gana la inmobiliaria. Gastos administrativos, punitorios,
 * comisiones e informes cobrados (por la fecha del cobro) y honorarios
 * descontados (por la fecha de la liquidación), entre `desde` y `hasta`
 * (excluido). El tablero lo agrega por mes; el detalle lo lista.
 */
function sqlMovimientosIngresos(desde: string, hasta: string) {
  return Prisma.sql`
    SELECT im.id, re.fecha, k.moneda, c.id AS contrato_id, c.tipo AS tipo_contrato, k.tipo, im.importe,
           k.descripcion, p.id AS persona_id, p.nombre
      FROM alq_imputacion im
      JOIN alq_concepto k ON k.id = im.concepto_id
      JOIN alq_contrato c ON c.id = k.contrato_id
      JOIN alq_persona p ON p.id = k.persona_id
      JOIN alq_cobro co ON co.id = im.cobro_id AND co.anulado_en IS NULL
      JOIN alq_cobro re ON re.id = im.registrada_en_cobro_id AND re.anulado_en IS NULL
     WHERE k.tipo IN ('gastos_adm', 'punitorio', 'comision', 'informe')
       AND re.fecha >= ${toDate(desde)} AND re.fecha < ${toDate(hasta)}
     UNION ALL
    SELECT k.id, l.fecha, k.moneda, c.id, c.tipo, k.tipo, k.importe, k.descripcion, p.id, p.nombre
      FROM alq_concepto k
      JOIN alq_contrato c ON c.id = k.contrato_id
      JOIN alq_liquidacion l ON l.id = k.liquidacion_id AND l.anulado_en IS NULL
      JOIN alq_persona p ON p.id = l.persona_id
     WHERE k.tipo = 'honorarios' AND l.fecha >= ${toDate(desde)} AND l.fecha < ${toDate(hasta)}`;
}

/** Los ingresos de cada mes, sumados en la base por tipo de concepto: no crecen con los movimientos. */
function sqlIngresosPorMes(desde: string, hasta: string) {
  return Prisma.sql`
    SELECT to_char(m.fecha, 'YYYY-MM') AS mes, m.moneda, m.tipo_contrato, m.tipo, SUM(m.importe) AS importe
      FROM (${sqlMovimientosIngresos(desde, hasta)}) m
     GROUP BY 1, 2, 3, 4
     ORDER BY 1, 2`;
}

/** Lo que se lee de cada contrato, para contar la cartera y para que cada fila del detalle sirva. */
const SELECT_CONTRATO = {
  id: true,
  codigo: true,
  estado: true,
  tipo: true,
  moneda: true,
  ajuste: true,
  inicio: true,
  fin: true,
  rescindidoEl: true,
  depositoImporte: true,
  depositoDevolucion: true,
  propiedad: { select: { direccion: true, unidad: true } },
  partes: { select: { personaId: true, papel: true, persona: { select: { nombre: true } } } },
  tramos: {
    select: { numero: true, desde: true, importe: true },
    orderBy: { numero: 'asc' },
  },
  documentos: { select: { estadoFirma: true } },
} satisfies Prisma.AlqContratoSelect;
type ContratoLeido = Prisma.AlqContratoGetPayload<{ select: typeof SELECT_CONTRATO }>;

const ORDEN_CONTRATOS = [
  { codigoNum: 'asc' },
  { codigo: 'asc' },
] satisfies Prisma.AlqContratoOrderByWithRelationInput[];

// --- Las definiciones: un número y su lista salen de acá --------------------------

type IndicadorCobranza = 'emitidos' | 'cobrados' | 'importeEmitido' | 'importeCobrado';

const importeDe = (r: FilaAlquiler) => decToNum(r.importe);
const cobradoDe = (r: FilaAlquiler) => redondear2(decToNum(r.cobrado));

/**
 * Reglas 28 y 75: qué alquileres cuenta cada número de la cobranza y con qué
 * importe. Uno pagado en parte no cuenta como cobrado, pero suma lo pagado.
 * El tablero suma cada mes con esto y el detalle lista con esto: no pueden
 * contradecirse.
 */
const COBRANZA: Record<
  IndicadorCobranza,
  { entra: (r: FilaAlquiler) => boolean; importe: (r: FilaAlquiler) => number; cuenta: boolean }
> = {
  emitidos: { entra: () => true, importe: importeDe, cuenta: true },
  cobrados: { entra: (r) => cobradoDe(r) >= importeDe(r), importe: importeDe, cuenta: true },
  importeEmitido: { entra: () => true, importe: importeDe, cuenta: false },
  importeCobrado: { entra: (r) => cobradoDe(r) > 0, importe: cobradoDe, cuenta: false },
};

/** Regla 30: a qué parte de los ingresos va cada tipo de concepto. */
const PARTE_DE_TIPO: Record<string, ParteIngresos> = {
  honorarios: 'honorarios',
  gastos_adm: 'gastos',
  punitorio: 'punitorios',
  comision: 'comisiones',
  informe: 'comisiones',
};
const NOMBRE_TIPO_INGRESO: Record<string, string> = {
  honorarios: 'Honorarios',
  gastos_adm: 'Gastos administrativos',
  punitorio: 'Punitorio',
  comision: 'Comisión',
  informe: 'Informe de garantía',
};

/**
 * Regla 77: si un contrato estaba vigente a una fecha. A hoy (o después) es su
 * estado, como siempre. Antes, por fechas: había empezado y no había
 * terminado —el fin, o la rescisión—. Uno que hoy sigue vigente lo estaba
 * desde que empezó, aunque ya haya pasado su fin y nadie lo haya finalizado:
 * así no aparece hoy y faltaba el mes pasado.
 */
export function vigenteAl(
  c: Pick<ContratoLeido, 'estado' | 'inicio' | 'fin' | 'rescindidoEl'>,
  fecha: string,
  hoy: string,
): boolean {
  if (fecha >= hoy) return c.estado === 'vigente';
  if (fromDate(c.inicio)! > fecha) return false;
  if (c.estado === 'vigente') return true;
  if (c.estado !== 'finalizado' && c.estado !== 'rescindido') return false;
  return fecha <= fromDate(c.rescindidoEl ?? c.fin)!;
}

const tramosDe = (c: ContratoLeido) =>
  c.tramos.map((t) => ({
    numero: t.numero,
    desde: fromDate(t.desde)!,
    importe: t.importe == null ? null : decToNum(t.importe),
  }));

/**
 * Regla 27 y 77: la cartera a una fecha —los vigentes y el alquiler de cada
 * uno ese día, por moneda—. La tarjeta, su lista y la foto de cada cierre
 * salen de acá.
 */
function carteraAl(contratos: ContratoLeido[], fecha: string, hoy: string) {
  const vigentes = contratos.filter((c) => vigenteAl(c, fecha, hoy));
  const alquiler = (c: ContratoLeido) => alquilerDeHoy(tramosDe(c), fecha);
  const monedas = [...new Set(vigentes.map((c) => c.moneda))].sort() as MonedaAlquiler[];
  return {
    vigentes,
    alquilerMensual: monedas.map((moneda) => ({
      moneda,
      contratos: vigentes
        .filter((c) => c.moneda === moneda && alquiler(c) != null)
        .map((c) => ({ c, importe: alquiler(c)! })),
    })),
  };
}

/**
 * Lo que se sabe de cada contrato, para que cada fila del detalle sirva
 * (Javier, 6/10/2026: «Propietario, Inquilino, Importe Alquiler vigente,
 * cuando indexa, cuando vence»). Todo sale de lo ya leído: ninguna consulta más.
 */
function fichas(contratos: ContratoLeido[], hoy: string) {
  const porId = new Map(contratos.map((c) => [c.id, c]));
  const nombresDe = (c: ContratoLeido, papel: string) =>
    c.partes
      .filter((p) => p.papel === papel)
      .map((p) => p.persona.nombre)
      .join(', ') || null;
  const direccionDe = (c: ContratoLeido) =>
    [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' ');
  // Las mismas definiciones que la lista de contratos (@vacker/domain).
  const importeDeHoy = (c: ContratoLeido) => alquilerDeHoy(tramosDe(c), hoy);
  const terminaEl = (c: ContratoLeido) => fromDate(c.rescindidoEl ?? c.fin)!;
  const vacia = { detalle: '', fecha: null, importe: null, dias: null, estado: null };
  const datosDe = (c: ContratoLeido | undefined) =>
    c
      ? {
          contrato: c.codigo,
          propiedad: direccionDe(c),
          inquilino: nombresDe(c, 'inquilino'),
          propietario: nombresDe(c, 'propietario'),
          persona: nombresDe(c, 'inquilino'),
          moneda: c.moneda as MonedaAlquiler,
          alquiler: importeDeHoy(c),
          indexa: c.estado === 'vigente' ? proximoCambio(tramosDe(c), hoy) : null,
          vence: terminaEl(c),
        }
      : {
          contrato: null,
          propiedad: null,
          inquilino: null,
          propietario: null,
          persona: null,
          moneda: null,
          alquiler: null,
          indexa: null,
          vence: null,
        };
  const filaContrato = (c: ContratoLeido, extra: Partial<FilaTablero> = {}): FilaTablero => ({
    id: c.id,
    href: aContrato(c.id),
    ...vacia,
    ...datosDe(c),
    ...extra,
  });
  /** Una fila de algo de un contrato (un concepto, un reclamo): los datos del contrato y lo propio. */
  const filaDe = (
    contratoId: string | null,
    extra: Partial<FilaTablero> & { id: string; href: string | null },
  ): FilaTablero => ({
    ...vacia,
    ...datosDe(contratoId ? porId.get(contratoId) : undefined),
    ...extra,
  });
  const diasHasta = (iso: string) => diasInclusive(hoy, iso) - 1;
  return { vacia, datosDe, filaContrato, filaDe, importeDeHoy, terminaEl, diasHasta };
}
type Fichas = ReturnType<typeof fichas>;

/** Cada número de la cobranza de unos alquileres de una moneda, con su lista. */
function cobranzaDe(
  rows: FilaAlquiler[],
  f: Fichas,
  hoy: string,
  moneda: MonedaAlquiler,
): Record<IndicadorCobranza, Indicador> {
  const estadoDe = (k: FilaAlquiler) => {
    const c = cobradoDe(k);
    const total = importeDe(k);
    if (c >= total) return 'Cobrado';
    if (c > 0) return `Pagó ${plata(c, moneda)}, falta ${plata(redondear2(total - c), moneda)}`;
    const vence = fromDate(k.vencimiento)!;
    return vence < hoy ? `Vencido hace ${enDias(-f.diasHasta(vence))}` : 'Pendiente';
  };
  const fila = (k: FilaAlquiler, importe: number): FilaTablero =>
    f.filaDe(k.contrato_id, {
      id: k.id,
      href: aPersona(k.persona_id),
      inquilino: k.nombre,
      persona: k.nombre,
      moneda,
      detalle: k.descripcion ?? 'Alquiler',
      fecha: fromDate(k.vencimiento),
      importe,
      estado: estadoDe(k),
    });
  const ks = rows.filter((k) => k.moneda === moneda);
  const indicador = (i: IndicadorCobranza) => {
    const def = COBRANZA[i];
    const filas = ks.filter(def.entra).map((k) => fila(k, def.importe(k)));
    return def.cuenta ? porCantidad(filas) : porImporte(filas);
  };
  return {
    emitidos: indicador('emitidos'),
    cobrados: indicador('cobrados'),
    importeEmitido: indicador('importeEmitido'),
    importeCobrado: indicador('importeCobrado'),
  };
}

/** La deuda vencida a un cierre, concepto por concepto, con su antigüedad a esa fecha. */
function moraAl(rows: FilaMora[], cierre: string, f: Fichas) {
  return rows
    .filter((m) => m.cierre === cierre)
    .map((m) => {
      const vence = fromDate(m.vencimiento)!;
      const dias = diasInclusive(vence, cierre) - 1;
      return {
        moneda: m.moneda as MonedaAlquiler,
        tramo: tramoDeMora(dias),
        dias,
        personaId: m.persona_id,
        fila: f.filaDe(m.contrato_id, {
          id: m.id,
          href: aPersona(m.persona_id),
          inquilino: m.nombre,
          persona: m.nombre,
          moneda: m.moneda as MonedaAlquiler,
          detalle: m.descripcion ?? m.tipo,
          fecha: vence,
          dias,
          importe: decToNum(m.saldo),
        }),
      };
    });
}

/** Regla 29: la deuda por moneda y por antigüedad. */
function morosidadDe(items: ReturnType<typeof moraAl>) {
  return [...new Set(items.map((x) => x.moneda))].sort().map((moneda) => {
    const fs = items.filter((x) => x.moneda === moneda);
    return {
      moneda: moneda as MonedaAlquiler,
      total: porImporte(fs.map((x) => x.fila)),
      inquilinos: new Set(fs.map((x) => x.personaId)).size,
      tramos: TRAMOS_MORA.map((tramo: TramoMora) => ({
        tramo,
        indicador: porImporte(fs.filter((x) => x.tramo === tramo).map((x) => x.fila)),
      })),
    };
  });
}

/** Los movimientos de ingresos como filas del detalle. */
function filaIngreso(m: MovimientoIngreso, f: Fichas): FilaTablero {
  const nombre = NOMBRE_TIPO_INGRESO[m.tipo] ?? m.tipo;
  return f.filaDe(m.contrato_id, {
    id: m.id,
    href: aContrato(m.contrato_id),
    persona: m.nombre,
    moneda: m.moneda as MonedaAlquiler,
    detalle: m.descripcion ? `${nombre} · ${m.descripcion}` : nombre,
    fecha: fromDate(m.fecha),
    importe: redondear2(decToNum(m.importe)),
  });
}

/** Los doce meses de un año, `AAAA-MM`. */
const mesesDe = (anio: number) =>
  Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);

/** El día siguiente al último del mes `AAAA-MM`: el tope (excluido) de un rango de fechas. */
const primeroDelSiguiente = (mes: string) => sumarMesesIso(`${mes}-01`, 1);

/**
 * El tablero del módulo Alquileres (spec alquileres-fase-1.md, reglas 26 a 32
 * y 74 a 82).
 *
 * Lo que crece con la historia se calcula en la base: la morosidad trae solo
 * los conceptos con saldo, y los ingresos vienen agregados por mes. Los
 * alquileres del año llegan uno por fila —son los del año, no la historia— y
 * se suman acá, con las mismas definiciones con que el detalle los lista. En
 * todos los casos, las consultas son las mismas tenga la inmobiliaria 10
 * contratos o 1.000.
 */
@Injectable()
export class TableroAlquileresService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly indexaciones: IndexacionesService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  /**
   * `anio` elige el año de los meses que la pantalla suma (regla 74), como el
   * Tablero Comercial. Lo que viaja con sus listas —cartera, morosidad y
   * tareas— es a hoy.
   */
  async tablero(
    hoy = hoyArgentina(),
    anio = Number(hoy.slice(0, 4)),
    tipo: FiltroTipoContrato = 'todos',
  ): Promise<TableroAlquileresDto> {
    return (await this.tableros(hoy, anio))[tipo];
  }

  /**
   * Los tres cortes —todos, particulares y comerciales— de una sola lectura.
   * El filtro tardaba cinco o seis segundos por toque porque cada uno volvía a
   * leer todo (Javier, 6/10/2026: «parece que no está funcionando»); ahora la
   * pantalla los trae juntos y cambiar de filtro no pide nada. Lo que se
   * agrega en la base viene separado por tipo y se suma acá.
   */
  async tableros(
    hoy = hoyArgentina(),
    anio = Number(hoy.slice(0, 4)),
  ): Promise<Record<FiltroTipoContrato, TableroAlquileresDto>> {
    const mes = hoy.slice(0, 7);
    const [datos, bandeja, aLiquidar] = await Promise.all([
      this.db.withTenant((tx) => this.leer(tx, hoy, mes, anio)),
      this.indexaciones.bandeja(hoy, DIAS_TABLERO_PROXIMOS),
      this.liquidaciones.pendientes(),
    ]);
    const armar = (tipo: FiltroTipoContrato) =>
      this.armar(datos, bandeja, aLiquidar, hoy, mes, anio, tipo);
    return { todos: armar('todos'), vivienda: armar('vivienda'), comercial: armar('comercial') };
  }

  /**
   * La lista de un número del período (regla 79), pedida al abrir su tarjeta.
   * Sale de la misma consulta y de la misma definición que el número que el
   * tablero sumó para ese período: la lista suma exactamente la tarjeta.
   *
   * Los flujos son de los meses `desde`…`hasta`; las fotos, al cierre de
   * `hasta` (regla 77). Dos consultas como mucho, haya los contratos que haya.
   */
  async detalle(q: DetalleTableroQuery, hoy = hoyArgentina()): Promise<Indicador> {
    const { indicador, desde, hasta, tipo, moneda } = q;
    const delTipo = (t: string | null) => tipo === 'todos' || t === tipo;
    const cierre = cierreDelMes(hasta, hoy);
    return this.db.withTenant(async (tx) => {
      const contratosDe = (ids: (string | null)[]) => {
        const unicos = [...new Set(ids.filter((x): x is string => !!x))];
        return unicos.length
          ? tx.alqContrato.findMany({
              where: { id: { in: unicos } },
              select: SELECT_CONTRATO,
              orderBy: ORDEN_CONTRATOS,
            })
          : Promise.resolve([] as ContratoLeido[]);
      };

      switch (indicador) {
        case 'emitidos':
        case 'cobrados':
        case 'importeEmitido':
        case 'importeCobrado': {
          const rows = (await tx.$queryRaw<FilaAlquiler[]>(sqlAlquileres(desde, hasta))).filter(
            (r) => delTipo(r.tipo_contrato),
          );
          const f = fichas(await contratosDe(rows.map((r) => r.contrato_id)), hoy);
          return cobranzaDe(rows, f, hoy, moneda)[indicador];
        }
        case 'ingresos':
        case 'honorarios':
        case 'gastos':
        case 'punitorios':
        case 'comisiones': {
          const rows = (
            await tx.$queryRaw<MovimientoIngreso[]>(
              Prisma.sql`SELECT * FROM (${sqlMovimientosIngresos(`${desde}-01`, primeroDelSiguiente(hasta))}) m ORDER BY m.fecha, m.id`,
            )
          ).filter(
            (m) =>
              delTipo(m.tipo_contrato) &&
              m.moneda === moneda &&
              (indicador === 'ingresos' || PARTE_DE_TIPO[m.tipo] === indicador),
          );
          const f = fichas(await contratosDe(rows.map((m) => m.contrato_id)), hoy);
          return porImporte(rows.map((m) => filaIngreso(m, f)));
        }
        case 'vigentes':
        case 'alquilerMensual': {
          const contratos = (
            await tx.alqContrato.findMany({
              where: {
                estado: { notIn: ['borrador', 'anulado'] },
                inicio: { lte: toDate(cierre)! },
                OR: [{ estado: 'vigente' }, { fin: { gte: toDate(cierre)! } }],
              },
              select: SELECT_CONTRATO,
              orderBy: ORDEN_CONTRATOS,
            })
          ).filter((c) => delTipo(c.tipo));
          const f = fichas(contratos, hoy);
          const cartera = carteraAl(contratos, cierre, hoy);
          if (indicador === 'vigentes')
            return porCantidad(cartera.vigentes.map((c) => f.filaContrato(c)));
          return porImporte(
            (cartera.alquilerMensual.find((a) => a.moneda === moneda)?.contratos ?? []).map(
              ({ c, importe }) => f.filaContrato(c, { importe }),
            ),
          );
        }
        case 'mora': {
          const rows = (await tx.$queryRaw<FilaMora[]>(sqlSaldosAlCierre([cierre]))).filter((m) =>
            delTipo(m.tipo_contrato),
          );
          const f = fichas(await contratosDe(rows.map((m) => m.contrato_id)), hoy);
          const m = morosidadDe(moraAl(rows, cierre, f)).find((x) => x.moneda === moneda);
          if (!m) return { valor: 0, filas: [] };
          return q.tramo ? m.tramos.find((x) => x.tramo === q.tramo)!.indicador : m.total;
        }
      }
    });
  }

  private armar(
    datos: Awaited<ReturnType<TableroAlquileresService['leer']>>,
    bandejaTodas: Awaited<ReturnType<IndexacionesService['bandeja']>>,
    aLiquidarTodos: Awaited<ReturnType<LiquidacionesService['pendientes']>>,
    hoy: string,
    mes: string,
    anio: number,
    tipo: FiltroTipoContrato,
  ): TableroAlquileresDto {
    const { contratos: todos, reclamos, polizas, boletas } = datos;
    const delTipoSql = <T extends { tipo_contrato: string | null }>(xs: T[]) =>
      tipo === 'todos' ? xs : xs.filter((x) => x.tipo_contrato === tipo);
    const alquileres = delTipoSql(datos.alquileres);
    const mora = delTipoSql(datos.mora);

    // El filtro Particulares / Comerciales (punto 8 de Javier) mira todo el
    // tablero: lo leído se filtra acá, sobre los contratos de la inmobiliaria.
    const contratos = tipo === 'todos' ? todos : todos.filter((c) => c.tipo === tipo);
    const delTipo = new Set(contratos.map((c) => c.id));
    const bandeja =
      tipo === 'todos'
        ? bandejaTodas
        : {
            ...bandejaTodas,
            tramos: bandejaTodas.tramos.filter((t) => delTipo.has(t.contrato.id)),
          };
    const aLiquidar =
      tipo === 'todos'
        ? aLiquidarTodos
        : aLiquidarTodos.filter((p) => p.contratos.some((c) => delTipo.has(c.id)));

    const f = fichas(todos, hoy);
    const { vacia, datosDe, filaContrato, filaDe, importeDeHoy, terminaEl, diasHasta } = f;
    type C = ContratoLeido;

    // --- Cartera a hoy (regla 27) ---
    const cartera = carteraAl(contratos, hoy, hoy);
    const vigentes = cartera.vigentes;

    // --- Cobranza del mes en curso (regla 28) ---
    // La pantalla de hoy suma `evolucion`; esto queda por el orden de despliegue.
    const delMes = alquileres.filter((k) => k.periodo === mes);
    const cobranza = [...new Set(delMes.map((k) => k.moneda))].sort().map((moneda) => ({
      moneda: moneda as MonedaAlquiler,
      ...cobranzaDe(delMes, f, hoy, moneda as MonedaAlquiler),
    }));

    // --- Los meses del año, sumados con las mismas definiciones que el detalle (reglas 29 y 75) ---
    const meses = mesesDe(anio);
    const evolucion = meses.flatMap((m) => {
      const delMesM = alquileres.filter((k) => k.periodo === m);
      return [...new Set(delMesM.map((k) => k.moneda))].sort().map((moneda) => {
        const ks = delMesM.filter((k) => k.moneda === moneda);
        const total = (i: IndicadorCobranza) =>
          sumar(ks.filter(COBRANZA[i].entra).map(COBRANZA[i].importe));
        const cuantos = (i: IndicadorCobranza) => ks.filter(COBRANZA[i].entra).length;
        return {
          mes: m,
          moneda: moneda as MonedaAlquiler,
          emitido: total('importeEmitido'),
          cobrado: sumar(ks.map((k) => decToNum(k.cobrado_al_cierre))),
          emitidos: cuantos('emitidos'),
          cobrados: cuantos('cobrados'),
          cobradoHoy: total('importeCobrado'),
        };
      });
    });

    // --- Ingresos por mes (regla 30): cada tipo de concepto a su parte ---
    const ingresosPorMes = new Map<
      string,
      Record<ParteIngresos, number> & { mes: string; moneda: string }
    >();
    for (const i of delTipoSql(datos.ingresos)) {
      const parte = PARTE_DE_TIPO[i.tipo];
      if (!parte) continue;
      const clave = `${i.mes}|${i.moneda}`;
      const previo = ingresosPorMes.get(clave) ?? {
        mes: i.mes,
        moneda: i.moneda,
        honorarios: 0,
        gastos: 0,
        punitorios: 0,
        comisiones: 0,
      };
      previo[parte] = redondear2(previo[parte] + decToNum(i.importe));
      ingresosPorMes.set(clave, previo);
    }

    // --- Morosidad a hoy (regla 29) y la foto de cada cierre (regla 77) ---
    const filasMora = moraAl(mora, hoy, f);
    const morosidad = morosidadDe(filasMora).map(({ inquilinos: _i, ...m }) => m);
    const cierres: CierreTablero[] = meses.map((m) => {
      const cierre = cierreDelMes(m, hoy);
      const c = carteraAl(contratos, cierre, hoy);
      return {
        mes: m,
        cierre,
        vigentes: c.vigentes.length,
        vivienda: c.vigentes.filter((x) => x.tipo === 'vivienda').length,
        comercial: c.vigentes.filter((x) => x.tipo === 'comercial').length,
        alquilerMensual: c.alquilerMensual.map((a) => ({
          moneda: a.moneda,
          valor: sumar(a.contratos.map((x) => x.importe)),
          contratos: a.contratos.length,
        })),
        mora: morosidadDe(moraAl(mora, cierre, f)).map((x) => ({
          moneda: x.moneda,
          valor: x.total.valor,
          conceptos: x.total.filas.length,
          inquilinos: x.inquilinos,
          tramos: x.tramos.map((t) => ({
            tramo: t.tramo,
            valor: t.indicador.valor,
            conceptos: t.indicador.filas.length,
          })),
        })),
      };
    });

    // --- Lo que hay que hacer (regla 31) ---
    const filaIndexacion = (t: (typeof bandeja.tramos)[number]): FilaTablero =>
      filaDe(t.contrato.id, {
        id: t.tramoId,
        href: aContrato(t.contrato.id),
        detalle: `Tramo ${t.numero} · ${t.indice}`,
        fecha: t.desde,
        dias: diasHasta(t.desde),
        alquiler: t.importeAnterior,
        importe: t.importePropuesto,
        estado:
          t.estado === 'pendiente_indice'
            ? `Espera ${t.falta.join(' y ') || 'el índice'}`
            : t.vencida
              ? 'Lista para confirmar (vencida)'
              : 'Lista para confirmar',
      });
    // La primera ventana arranca sin piso: un contrato que ya terminó y sigue
    // «vigente» (nadie lo finalizó ni lo renovó) también hay que atenderlo.
    const vencenEntre = (desde: number | null, hasta: number) =>
      vigentes.filter((c) => {
        const fin = fromDate(c.fin)!;
        return (desde == null || fin > sumarDiasIso(hoy, desde)) && fin <= sumarDiasIso(hoy, hasta);
      });
    const filaVence = (c: C) => filaContrato(c, { dias: diasHasta(fromDate(c.fin)!) });
    const depositos = contratos.filter((c) => {
      if (
        c.depositoImporte == null ||
        decToNum(c.depositoImporte) <= 0 ||
        c.depositoDevolucion != null
      )
        return false;
      return c.estado !== 'vigente' || terminaEl(c) <= sumarDiasIso(hoy, 30);
    });
    const deudores = new Map<string, FilaTablero & { conceptos: number }>();
    for (const x of filasMora.filter((y) => y.dias > 30)) {
      const clave = `${x.personaId}|${x.moneda}`;
      const previo = deudores.get(clave);
      const desde = previo?.fecha && previo.fecha < x.fila.fecha! ? previo.fecha : x.fila.fecha;
      const conceptos = (previo?.conceptos ?? 0) + 1;
      deudores.set(clave, {
        ...x.fila,
        id: clave,
        conceptos,
        detalle: `${conceptos} ${conceptos === 1 ? 'concepto' : 'conceptos'} con más de 30 días`,
        fecha: desde,
        dias: desde ? diasInclusive(desde, hoy) - 1 : null,
        importe: redondear2((previo?.importe ?? 0) + x.fila.importe!),
      });
    }

    // --- Reparto de la cartera por tipo, siempre de todos (punto 8) ---
    const vigentesTodos = todos.filter((c) => c.estado === 'vigente');
    const pesosDe = (xs: typeof todos) =>
      redondear2(
        xs.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + (importeDeHoy(c) ?? 0), 0),
      );
    const totalPesos = pesosDe(vigentesTodos);
    const porTipo = (['vivienda', 'comercial'] as const).map((t) => {
      const xs = vigentesTodos.filter((c) => c.tipo === t);
      const importe = pesosDe(xs);
      return {
        tipo: t,
        cantidad: xs.length,
        importe,
        pct: totalPesos > 0 ? Math.round((importe / totalPesos) * 1000) / 10 : 0,
      };
    });

    // --- Contratos nuevos (punto 8): los que empiezan en cada mes ---
    const empiezaEn = (c: C) => fromDate(c.inicio)!.slice(0, 7);
    const importeInicial = (c: C) =>
      c.tramos[0]?.importe != null ? decToNum(c.tramos[0].importe) : 0;
    const nuevosDe = (m: string) => contratos.filter((c) => empiezaEn(c) === m);
    const nuevos = {
      porMes: meses.map((m) =>
        porCantidad(
          nuevosDe(m).map((c) =>
            filaContrato(c, {
              fecha: fromDate(c.inicio),
              importe: importeInicial(c),
              estado: NOMBRE_ESTADO_CONTRATO[c.estado as EstadoContrato] ?? c.estado,
            }),
          ),
        ),
      ),
      importePorMes: meses.map((m) =>
        redondear2(
          nuevosDe(m)
            .filter((c) => c.moneda === 'ARS')
            .reduce((s, c) => s + importeInicial(c), 0),
        ),
      ),
      anterior: mesesDe(anio - 1).map((m) => nuevosDe(m).length),
    };

    // --- Escalones por iniciar (Gexion): contratos escalonados que cambian de importe pronto ---
    const hasta = sumarDiasIso(hoy, DIAS_TABLERO_PROXIMOS);
    const escalones = vigentes.flatMap((c) =>
      c.ajuste !== 'escalonado'
        ? []
        : c.tramos
            .filter((t) => t.numero > 1 && fromDate(t.desde)! > hoy && fromDate(t.desde)! <= hasta)
            .map((t) =>
              filaContrato(c, {
                id: `${c.id}|${t.numero}`,
                detalle: `Escalón ${t.numero}`,
                fecha: fromDate(t.desde),
                dias: diasHasta(fromDate(t.desde)!),
                importe: t.importe == null ? null : decToNum(t.importe),
              }),
            ),
    );

    return {
      hoy,
      mes,
      anio,
      tipo,
      nuevos,
      cartera: {
        porTipo,
        vigentes: porCantidad(vigentes.map((c) => filaContrato(c))),
        vivienda: vigentes.filter((c) => c.tipo === 'vivienda').length,
        comercial: vigentes.filter((c) => c.tipo === 'comercial').length,
        alquilerMensual: cartera.alquilerMensual.map((a) => ({
          moneda: a.moneda,
          indicador: porImporte(a.contratos.map(({ c, importe }) => filaContrato(c, { importe }))),
        })),
      },
      cobranza,
      morosidad,
      evolucion,
      cierres,
      ingresos: [...ingresosPorMes.values()]
        .sort((a, b) => (a.mes + a.moneda < b.mes + b.moneda ? -1 : 1))
        .map((i) => ({
          mes: i.mes,
          moneda: i.moneda as MonedaAlquiler,
          honorarios: i.honorarios,
          gastos: i.gastos,
          punitorios: i.punitorios,
          comisiones: i.comisiones,
        })),
      tareas: {
        indexacionesVencidas: porCantidad(
          bandeja.tramos.filter((t) => t.vencida).map(filaIndexacion),
        ),
        indexacionesProximas: porCantidad(
          bandeja.tramos.filter((t) => !t.vencida).map(filaIndexacion),
        ),
        vencen: [
          { dias: 30 as const, indicador: porCantidad(vencenEntre(null, 30).map(filaVence)) },
          { dias: 60 as const, indicador: porCantidad(vencenEntre(30, 60).map(filaVence)) },
          { dias: 90 as const, indicador: porCantidad(vencenEntre(60, 90).map(filaVence)) },
        ],
        depositos: porCantidad(
          depositos.map((c) =>
            filaContrato(c, {
              importe: decToNum(c.depositoImporte),
              estado:
                c.estado === 'vigente'
                  ? `Termina en ${enDias(diasHasta(terminaEl(c)))}`
                  : terminaEl(c) <= hoy
                    ? `Terminó hace ${enDias(-diasHasta(terminaEl(c)))}`
                    : (NOMBRE_ESTADO_CONTRATO[c.estado as EstadoContrato] ?? c.estado),
            }),
          ),
        ),
        liquidaciones: porCantidad(
          aLiquidar
            .filter((p) => p.neto > 0)
            .map((p) => ({
              ...vacia,
              ...datosDe(undefined),
              id: `${p.persona.id}|${p.moneda}`,
              href: `/alquileres/liquidaciones/nueva?persona=${p.persona.id}`,
              persona: p.persona.nombre,
              propietario: p.persona.nombre,
              contrato: p.contratos.map((c) => c.codigo).join(', ') || null,
              propiedad: p.contratos.map((c) => c.propiedad).join(' · ') || null,
              inquilino: [...new Set(p.contratos.flatMap((c) => c.inquilinos))].join(', ') || null,
              moneda: p.moneda,
              importe: p.neto,
              estado: p.enEspera > 0 ? `${plata(p.enEspera, p.moneda)} en espera` : null,
            })),
        ),
        deudores: porCantidad(
          [...deudores.values()]
            .sort((a, b) => (b.importe ?? 0) - (a.importe ?? 0))
            .map(({ conceptos: _c, ...x }) => x),
        ),
        // Regla 36: puede estar vigente sin firma electrónica (se firmó en
        // papel), pero el contrato firmado tiene que quedar cargado.
        sinFirmar: porCantidad(
          vigentes
            .filter((c) => !c.documentos.some((d) => d.estadoFirma === 'firmado'))
            .map((c) =>
              filaContrato(c, {
                fecha: fromDate(c.inicio),
                estado: c.documentos.length
                  ? 'Falta completar la firma'
                  : 'Falta cargar el contrato firmado',
              }),
            ),
        ),
        escalones: porCantidad(
          escalones.sort((a, b) => ((a.fecha ?? '') < (b.fecha ?? '') ? -1 : 1)),
        ),
        reclamos: porCantidad(
          reclamos
            .filter((r) => tipo === 'todos' || (r.contratoId != null && delTipo.has(r.contratoId)))
            .map((r) =>
              filaDe(r.contratoId, {
                id: r.id,
                href: `/alquileres/reclamos/${r.id}`,
                detalle: r.asunto,
                fecha: fromDate(r.createdAt),
                dias: diasInclusive(fromDate(r.createdAt)!, hoy) - 1,
                estado: nombrePrioridad(PrioridadReclamoSchema.catch('media').parse(r.prioridad)),
              }),
            ),
        ),
        // Entrega 19: las pólizas de los vigentes que vencen y lo que paga la inmobiliaria.
        polizas: porCantidad(
          polizas
            .filter(
              (p) =>
                p.contrato.estado === 'vigente' &&
                delTipo.has(p.contratoId) &&
                fromDate(p.hasta)! <= sumarDiasIso(hoy, DIAS_TABLERO_PROXIMOS),
            )
            .map((p) => {
              const hastaP = fromDate(p.hasta)!;
              return filaDe(p.contratoId, {
                id: p.id,
                href: aContrato(p.contratoId),
                detalle: `${p.aseguradora}${p.numero ? ` N° ${p.numero}` : ''}`,
                fecha: hastaP,
                dias: diasHasta(hastaP),
                estado: hastaP < hoy ? 'Vencida' : `Vence en ${enDias(diasHasta(hastaP))}`,
              });
            }),
        ),
        boletas: porCantidad(
          boletas
            .filter((b) => tipo === 'todos' || (b.contratoId != null && delTipo.has(b.contratoId)))
            .map((b) => {
              const vence = fromDate(b.vencimiento)!;
              return filaDe(b.contratoId, {
                id: b.id,
                href: '/alquileres/impuestos?ver=pagar',
                moneda: 'ARS',
                detalle: `${b.cuenta ? b.cuenta.servicio.nombre : `Póliza ${b.poliza?.aseguradora ?? ''}`}${b.cuota ? ` · ${textoCuota(b.cuota)}` : ''}`,
                fecha: vence,
                dias: diasHasta(vence),
                importe: decToNum(b.importe),
                estado:
                  vence < hoy
                    ? `Vencida hace ${enDias(-diasHasta(vence))}`
                    : vence === hoy
                      ? 'Vence hoy'
                      : `Vence en ${enDias(diasHasta(vence))}`,
              });
            }),
        ),
      },
    };
  }

  /**
   * Siete consultas, siempre las mismas, en una transacción: todas ven la
   * misma foto de la base (regla 82).
   */
  private async leer(tx: Tx, hoy: string, mes: string, anio: number) {
    // El año elegido y el anterior, para la planilla, y siempre el mes en
    // curso, por el orden de despliegue de la pantalla anterior.
    const anioHoy = Number(hoy.slice(0, 4));
    const desdeIngresos = `${Math.min(anio - 1, anioHoy)}-01-01`;
    const hastaIngresos = `${Math.max(anio, anioHoy) + 1}-01-01`;
    // El cierre de cada mes del año y hoy: la deuda de la foto de cada mes y la de hoy.
    const cierres = [...new Set([...mesesDe(anio).map((m) => cierreDelMes(m, hoy)), hoy])].sort();
    const [alquileres, mora, ingresos, reclamos, polizas, boletas] = await Promise.all([
      tx.$queryRaw<FilaAlquiler[]>(sqlAlquileres(`${anio}-01`, `${anio}-12`, mes)),
      tx.$queryRaw<FilaMora[]>(sqlSaldosAlCierre(cierres)),
      tx.$queryRaw<
        {
          mes: string;
          moneda: string;
          tipo_contrato: string | null;
          tipo: string;
          importe: Prisma.Decimal;
        }[]
      >(sqlIngresosPorMes(desdeIngresos, hastaIngresos)),
      // Reclamos abiertos o en curso (entrega 15).
      tx.alqReclamo.findMany({
        where: { estado: { in: [...ESTADOS_RECLAMO_ABIERTOS] } },
        select: { id: true, asunto: true, prioridad: true, contratoId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // La última póliza de cada contrato vigente: una vieja ya renovada no
      // es una póliza vencida (antes quedaba «Vencida» para siempre).
      tx.alqPoliza.findMany({
        where: { anuladoEn: null, contrato: { estado: 'vigente' } },
        distinct: ['contratoId'],
        orderBy: [{ contratoId: 'asc' }, { hasta: 'desc' }],
        select: {
          id: true,
          contratoId: true,
          aseguradora: true,
          numero: true,
          hasta: true,
          contrato: { select: { codigo: true, estado: true } },
        },
      }),
      tx.alqBoleta.findMany({
        where: {
          paga: 'inmobiliaria',
          pagadaEl: null,
          anuladoEn: null,
          vencimiento: { lte: toDate(sumarDiasIso(hoy, 7))! },
        },
        select: {
          id: true,
          contratoId: true,
          cuota: true,
          vencimiento: true,
          importe: true,
          cuenta: { select: { servicio: { select: { nombre: true } } } },
          poliza: { select: { aseguradora: true } },
        },
        orderBy: { vencimiento: 'asc' },
      }),
    ]);
    // Los contratos que nombran las listas que viajan con el tablero: los
    // alquileres del mes, la deuda de hoy, los reclamos y las boletas.
    const nombrados = [
      ...new Set(
        [...reclamos, ...boletas]
          .map((x) => x.contratoId)
          .concat(alquileres.filter((k) => k.periodo === mes).map((k) => k.contrato_id))
          .concat(mora.filter((m) => m.cierre === hoy).map((m) => m.contrato_id))
          .filter((x): x is string => !!x),
      ),
    ];
    const contratos = await tx.alqContrato.findMany({
      // No todos los de la historia (un tercio se renueva por año): los vigentes,
      // los que siguieron en algún momento del año elegido (la foto de cada
      // cierre), los que empezaron desde el año anterior (contratos nuevos y su
      // comparación), los que deben el depósito y los que nombran las listas.
      where: {
        estado: { notIn: ['borrador', 'anulado'] },
        OR: [
          { estado: 'vigente' },
          { fin: { gte: toDate(`${anio}-01-01`)! } },
          { inicio: { gte: toDate(`${anio - 1}-01-01`)! } },
          { depositoImporte: { gt: 0 }, depositoDevolucion: null },
          { id: { in: nombrados } },
        ],
      },
      select: SELECT_CONTRATO,
      orderBy: ORDEN_CONTRATOS,
    });
    return { contratos, alquileres, mora, ingresos, reclamos, polizas, boletas };
  }
}
