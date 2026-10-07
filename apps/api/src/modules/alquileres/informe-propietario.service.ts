import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  TIPOS_QUE_SE_LE_DESCUENTAN,
  alquilerDeHoy,
  cadenaDelInforme,
  categoriaDelInforme,
  estadosDelInforme,
  mesesDelRango,
  proximoCambio,
  redondear2,
  sumarCadenas,
  sumarMesesIso,
  ultimoDiaDelMes,
  type CategoriaInforme,
  type EstadoDelConcepto,
} from '@vacker/domain';
import type {
  CadenaInformeDto,
  CategoriaPartida,
  EstadoContrato,
  EstadoReclamo,
  InformePeriodoQuery,
  InformePropietarioDto,
  InformePropietariosDto,
  MedioCobro,
  MonedaAlquiler,
} from '@vacker/types';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { decToNum, fromDate } from '../tablero/tablero.util';
import { alquileresDelInquilino, fraccionesCobradas } from './cobrado-del-inquilino';
import { IMPUTACION_ACTIVA } from './imputacion-activa';
import { sqlSaldosAlCierre, type FilaMora } from './tablero-alquileres.service';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const SELECT_CONTRATO = {
  id: true,
  codigo: true,
  moneda: true,
  estado: true,
  inicio: true,
  fin: true,
  rescindidoEl: true,
  pagoGarantizado: true,
  propiedad: { select: { direccion: true, unidad: true } },
  partes: {
    where: { papel: { in: ['propietario', 'inquilino'] } },
    select: {
      personaId: true,
      papel: true,
      porcentaje: true,
      persona: { select: { nombre: true } },
    },
  },
  tramos: { select: { numero: true, desde: true, importe: true } },
} satisfies Prisma.AlqContratoSelect;
type FilaContrato = Prisma.AlqContratoGetPayload<{ select: typeof SELECT_CONTRATO }>;

/** El día (en la Argentina) de un instante, como `YYYY-MM-DD`. */
const diaArgentino = (d: Date): string =>
  d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
/** La medianoche argentina de un día: lo que separa un mes de otro para un `timestamptz`. */
const medianocheArgentina = (dia: string) => new Date(`${dia}T03:00:00.000Z`);

const direccionDe = (p: { direccion: string; unidad: string | null }) =>
  [p.direccion, p.unidad].filter(Boolean).join(' ');

/** Un concepto del propietario, con su renglón y en qué está cada peso. */
interface Fila {
  id: string;
  personaId: string;
  contratoId: string;
  periodo: string;
  moneda: MonedaAlquiler;
  tipo: string;
  sentido: 'a_cobrar' | 'a_pagar';
  categoria: CategoriaInforme;
  descripcion: string;
  clave: string | null;
  claveOrigen: string | null;
  liquidacion: {
    id: string;
    numero: number;
    fecha: string;
    medio: MedioCobro;
    moneda: MonedaAlquiler;
    neto: number;
  } | null;
  estado: EstadoDelConcepto;
}

/** Todo lo que el informe necesita, leído de una vez para uno o para todos los propietarios. */
interface Lectura {
  contratos: FilaContrato[];
  filas: Fila[];
  /** `contrato|periodo` → cuándo pagó el inquilino ese mes. */
  cobradoEl: Map<string, string[]>;
  boletas: Map<string, { servicio: string | null; poliza: string | null }>;
  comprobantes: Map<string, { proveedor: string; descripcion: string; reclamo: number | null }>;
  reclamos: {
    id: string;
    numero: number;
    asunto: string;
    estado: string;
    createdAt: Date;
    contratoId: string | null;
    personaId: string | null;
    proveedor: { nombre: string } | null;
    comprobantes: { importe: Prisma.Decimal; moneda: string }[];
  }[];
  mora: FilaMora[];
}

/**
 * El informe al propietario (spec alquileres-fase-1.md, reglas 83 a 97).
 *
 * Una sola lectura para un propietario o para todos —`leer`—, con un número
 * fijo de consultas (regla 97), y un solo armado —`armar`—: la fila de la
 * tabla de propietarios es exactamente el resumen de su informe.
 *
 * Mira lo mismo que la liquidación: sus conceptos en contratos donde es
 * propietario, con la misma propuesta (`estadosDelInforme` usa
 * `proponerLiquidacion`) y la misma fracción cobrada al inquilino
 * (`fraccionesCobradas`). Las notas internas de los reclamos no se leen.
 */
@Injectable()
export class InformePropietarioService {
  constructor(private readonly db: TenantPrismaService) {}

  async informe(
    personaId: string,
    q: InformePeriodoQuery,
    hoy = hoyArgentina(),
  ): Promise<InformePropietarioDto> {
    return this.db.withTenant(async (tx) => {
      const persona = await tx.alqPersona.findUnique({
        where: { id: personaId },
        select: { id: true, nombre: true },
      });
      if (!persona) throw new NotFoundException('La persona no existe.');
      const l = await this.leer(tx, q, hoy, personaId);
      if (l.contratos.length === 0)
        throw new NotFoundException(`${persona.nombre} no es propietario de ningún contrato.`);
      return armar(persona, l, q, hoy);
    });
  }

  async propietarios(
    q: InformePeriodoQuery,
    hoy = hoyArgentina(),
  ): Promise<InformePropietariosDto> {
    return this.db.withTenant(async (tx) => {
      const l = await this.leer(tx, q, hoy);
      const duenos = new Map<string, string>();
      for (const c of l.contratos)
        for (const p of c.partes)
          if (p.papel === 'propietario') duenos.set(p.personaId, p.persona.nombre);
      const filas: InformePropietariosDto['filas'] = [];
      for (const [id, nombre] of duenos) {
        const inf = armar({ id, nombre }, l, q, hoy);
        // Sin contratos en el período ni nada que contar, no es parte de este informe.
        if (inf.contratos.length === 0) continue;
        filas.push({
          persona: inf.persona,
          contratos: inf.contratos.length,
          reclamos: inf.reclamos.length,
          monedas: inf.resumen,
        });
      }
      filas.sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre, 'es'));
      return { desde: q.desde, hasta: q.hasta, hoy, filas, totales: totalesPorMoneda(filas) };
    });
  }

  /**
   * Las consultas, siempre las mismas: los contratos con sus partes y tramos,
   * los conceptos del propietario del período, los alquileres de sus
   * inquilinos (para la fracción cobrada y las fechas), los nombres de las
   * boletas y de los comprobantes, los reclamos y la deuda a hoy. No crecen
   * con los contratos ni con los propietarios.
   */
  private async leer(
    tx: Tx,
    q: InformePeriodoQuery,
    hoy: string,
    personaId?: string,
  ): Promise<Lectura> {
    const periodos = mesesDelRango(q.desde, q.hasta);
    const contratos = await tx.alqContrato.findMany({
      where: {
        // Lo que todavía no es un contrato no es del propietario (regla 83).
        estado: { notIn: ['borrador', 'anulado'] },
        partes: { some: { papel: 'propietario', ...(personaId ? { personaId } : {}) } },
      },
      select: SELECT_CONTRATO,
      orderBy: { codigo: 'asc' },
    });
    const vacia: Lectura = {
      contratos,
      filas: [],
      cobradoEl: new Map(),
      boletas: new Map(),
      comprobantes: new Map(),
      reclamos: [],
      mora: [],
    };
    if (contratos.length === 0) return vacia;
    const ids = contratos.map((c) => c.id);
    const duenos = [
      ...new Set(
        contratos.flatMap((c) =>
          c.partes.filter((p) => p.papel === 'propietario').map((p) => p.personaId),
        ),
      ),
    ];
    const inicio = medianocheArgentina(`${q.desde}-01`);
    const despues = medianocheArgentina(sumarMesesIso(`${q.hasta}-01`, 1));

    const [conceptos, delInquilino, reclamos, mora] = await Promise.all([
      tx.alqConcepto.findMany({
        where: {
          contratoId: { in: ids },
          periodo: { in: periodos },
          anuladoEn: null,
          ...(personaId ? { personaId } : {}),
          OR: [
            { sentido: 'a_pagar' },
            { sentido: 'a_cobrar', tipo: { in: [...TIPOS_QUE_SE_LE_DESCUENTAN] } },
          ],
        },
        select: {
          id: true,
          personaId: true,
          contratoId: true,
          periodo: true,
          moneda: true,
          tipo: true,
          sentido: true,
          importe: true,
          descripcion: true,
          claveGeneracion: true,
          claveOrigen: true,
          origenId: true,
          liquidacionId: true,
          liquidacion: {
            select: { id: true, numero: true, fecha: true, medio: true, moneda: true, neto: true },
          },
          imputaciones: { where: IMPUTACION_ACTIVA, select: { importe: true } },
        },
        orderBy: [{ periodo: 'asc' }, { createdAt: 'asc' }],
      }),
      tx.alqConcepto.findMany({
        where: alquileresDelInquilino(ids, periodos),
        select: {
          tipo: true,
          importe: true,
          claveGeneracion: true,
          contratoId: true,
          periodo: true,
          imputaciones: {
            where: IMPUTACION_ACTIVA,
            select: { importe: true, registradaEnCobro: { select: { fecha: true } } },
          },
        },
      }),
      // Regla 92: abiertos o activos en el período. Sin las notas: no se piden.
      tx.alqReclamo.findMany({
        where: {
          OR: [{ contratoId: { in: ids } }, { personaId: personaId ? personaId : { in: duenos } }],
          createdAt: { lt: despues },
          AND: [
            {
              OR: [
                { estado: { notIn: ['resuelto', 'cerrado'] } },
                { cerradoEn: { gte: inicio } },
                { cerradoEn: null, createdAt: { gte: inicio } },
              ],
            },
          ],
        },
        select: {
          id: true,
          numero: true,
          asunto: true,
          estado: true,
          createdAt: true,
          contratoId: true,
          personaId: true,
          proveedor: { select: { nombre: true } },
          comprobantes: {
            where: { aCargoDe: 'propietario', anuladoEn: null },
            select: { importe: true, moneda: true },
          },
        },
        orderBy: { numero: 'asc' },
      }),
      tx.$queryRaw<FilaMora[]>(sqlSaldosAlCierre([hoy], ids)),
    ]);

    // Solo lo suyo como propietario (regla 86): lo de un contrato donde es
    // inquilino no entra, como en la liquidación.
    const propietarios = new Map(
      contratos.map((c) => [
        c.id,
        new Set(c.partes.filter((p) => p.papel === 'propietario').map((p) => p.personaId)),
      ]),
    );
    const garantizado = new Map(contratos.map((c) => [c.id, c.pagoGarantizado]));
    const suyos = conceptos
      .map((k) => ({ k, categoria: categoriaDelInforme(k.tipo, k.sentido) }))
      .filter(
        (x): x is { k: (typeof conceptos)[number]; categoria: CategoriaInforme } =>
          x.categoria != null && !!propietarios.get(x.k.contratoId!)?.has(x.k.personaId),
      );
    // Por propietario y moneda, como arma la bandeja de liquidaciones su propuesta:
    // así cada informe sale igual leído solo o junto con todos los demás.
    const fracciones = fraccionesCobradas(delInquilino);
    const grupos = new Map<string, typeof suyos>();
    for (const x of suyos) {
      const clave = `${x.k.personaId}|${x.k.moneda}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), x]);
    }
    const estados = new Map<string, EstadoDelConcepto>();
    for (const grupo of grupos.values())
      for (const [id, e] of estadosDelInforme(
        grupo.map(({ k }) => ({
          id: k.id,
          tipo: k.tipo,
          sentido: k.sentido as 'a_cobrar' | 'a_pagar',
          base: redondear2(
            decToNum(k.importe) - k.imputaciones.reduce((s, i) => s + decToNum(i.importe), 0),
          ),
          liquidado: k.liquidacionId != null,
          clave: k.claveGeneracion,
          origenId: k.origenId,
          pagoGarantizado: garantizado.get(k.contratoId!) ?? false,
        })),
        fracciones,
      ))
        estados.set(id, e);
    const filas: Fila[] = suyos.map(({ k, categoria }) => ({
      id: k.id,
      personaId: k.personaId,
      contratoId: k.contratoId!,
      periodo: k.periodo!,
      moneda: k.moneda as MonedaAlquiler,
      tipo: k.tipo,
      sentido: k.sentido as 'a_cobrar' | 'a_pagar',
      categoria,
      descripcion: k.descripcion ?? k.tipo,
      clave: k.claveGeneracion,
      claveOrigen: k.claveOrigen,
      liquidacion: k.liquidacion
        ? {
            id: k.liquidacion.id,
            numero: k.liquidacion.numero,
            fecha: fromDate(k.liquidacion.fecha)!,
            medio: k.liquidacion.medio as MedioCobro,
            moneda: k.liquidacion.moneda as MonedaAlquiler,
            neto: decToNum(k.liquidacion.neto),
          }
        : null,
      estado: estados.get(k.id)!,
    }));

    const cobradoEl = new Map<string, string[]>();
    for (const k of delInquilino) {
      const clave = `${k.contratoId}|${k.periodo}`;
      const fechas = new Set(cobradoEl.get(clave) ?? []);
      for (const i of k.imputaciones) fechas.add(fromDate(i.registradaEnCobro.fecha)!);
      cobradoEl.set(clave, [...fechas].sort());
    }

    // Los nombres de los impuestos y de los proveedores (regla 91): de dónde salió cada concepto.
    const origenes = (prefijo: string) => [
      ...new Set(
        filas
          .filter((f) => f.clave?.startsWith(prefijo) && f.claveOrigen)
          .map((f) => f.claveOrigen!),
      ),
    ];
    const [deBoletas, deComprobantes] = [origenes('bol|'), origenes('prov|')];
    const [boletas, comprobantes] = await Promise.all([
      deBoletas.length
        ? tx.alqBoleta.findMany({
            where: { id: { in: deBoletas } },
            select: {
              id: true,
              cuenta: { select: { servicio: { select: { nombre: true } } } },
              poliza: { select: { aseguradora: true } },
            },
          })
        : [],
      deComprobantes.length
        ? tx.alqComprobante.findMany({
            where: { id: { in: deComprobantes } },
            select: {
              id: true,
              descripcion: true,
              proveedor: { select: { nombre: true } },
              reclamo: { select: { numero: true } },
            },
          })
        : [],
    ]);

    return {
      contratos,
      filas,
      cobradoEl,
      boletas: new Map(
        boletas.map((b) => [
          b.id,
          {
            servicio: b.cuenta?.servicio.nombre ?? null,
            poliza: b.poliza ? `Póliza ${b.poliza.aseguradora}` : null,
          },
        ]),
      ),
      comprobantes: new Map(
        comprobantes.map((c) => [
          c.id,
          {
            proveedor: c.proveedor.nombre,
            descripcion: c.descripcion,
            reclamo: c.reclamo?.numero ?? null,
          },
        ]),
      ),
      reclamos,
      mora,
    };
  }
}

const aCentavos = (n: number) => Math.round(n * 100);

/** El informe de una persona con lo ya leído. Lo usan el informe y la tabla de propietarios. */
function armar(
  persona: { id: string; nombre: string },
  l: Lectura,
  q: InformePeriodoQuery,
  hoy: string,
): InformePropietarioDto {
  const propios = l.contratos.filter((c) =>
    c.partes.some((p) => p.papel === 'propietario' && p.personaId === persona.id),
  );
  const idsPropios = new Set(propios.map((c) => c.id));
  const filas = l.filas.filter((f) => f.personaId === persona.id && idsPropios.has(f.contratoId));
  const reclamos = l.reclamos.filter(
    (r) => (r.contratoId && idsPropios.has(r.contratoId)) || r.personaId === persona.id,
  );
  const primerDia = `${q.desde}-01`;
  const ultimoDia = ultimoDiaDelMes(q.hasta);
  const conAlgo = new Set([
    ...filas.map((f) => f.contratoId),
    ...reclamos.map((r) => r.contratoId).filter((x): x is string => !!x),
  ]);
  // Sus contratos del período: los que estuvieron en curso, y los que tienen algo que contar.
  const contratos = propios.filter(
    (c) =>
      conAlgo.has(c.id) ||
      (fromDate(c.inicio)! <= ultimoDia && fromDate(c.rescindidoEl ?? c.fin)! >= primerDia),
  );
  const porId = new Map(contratos.map((c) => [c.id, c]));

  // Regla 87: una cadena por moneda; regla 94: una moneda sin movimientos no aparece.
  const monedas = [...new Set(filas.map((f) => f.moneda))].sort();
  const resumen: CadenaInformeDto[] = monedas
    .map((moneda) => ({
      moneda,
      ...cadenaDelInforme(
        filas
          .filter((f) => f.moneda === moneda)
          .map((f) => ({ categoria: f.categoria, ...f.estado })),
      ),
    }))
    .filter((c) => Object.values(c).some((v) => typeof v === 'number' && v !== 0));

  // Regla 89: lo vencido que deben hoy sus inquilinos, por moneda y contrato.
  const deuda = new Map<MonedaAlquiler, Map<string, { inquilino: string; importe: number }>>();
  for (const m of l.mora.filter((x) => x.contrato_id && idsPropios.has(x.contrato_id))) {
    const moneda = m.moneda as MonedaAlquiler;
    const delContrato = deuda.get(moneda) ?? new Map();
    const previo = delContrato.get(m.contrato_id!) ?? { inquilino: m.nombre, importe: 0 };
    delContrato.set(m.contrato_id!, {
      inquilino: previo.inquilino,
      importe: (aCentavos(previo.importe) + aCentavos(decToNum(m.saldo))) / 100,
    });
    deuda.set(moneda, delContrato);
  }

  const liquidaciones = new Map<string, InformePropietarioDto['liquidaciones'][number]>();
  for (const f of filas) {
    if (!f.liquidacion) continue;
    const signo = f.sentido === 'a_pagar' ? 1 : -1;
    const previa = liquidaciones.get(f.liquidacion.id) ?? { ...f.liquidacion, delPeriodo: 0 };
    previa.delPeriodo =
      (aCentavos(previa.delPeriodo) + signo * aCentavos(f.estado.liquidado)) / 100;
    liquidaciones.set(f.liquidacion.id, previa);
  }

  return {
    persona,
    desde: q.desde,
    hasta: q.hasta,
    hoy,
    resumen,
    deuda: [...deuda]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([moneda, cs]) => ({
        moneda,
        total: [...cs.values()].reduce((s, x) => s + aCentavos(x.importe), 0) / 100,
        contratos: [...cs].map(([id, x]) => ({ id, codigo: porId.get(id)?.codigo ?? '', ...x })),
      })),
    contratos: contratos.map((c) => contratoDelInforme(c, persona.id, filas, l.cobradoEl, hoy)),
    partidas: filas
      .filter((f) => f.categoria !== 'alquiler')
      .map((f) => ({ f, importe: redondear2(f.estado.liquidado + f.estado.pendiente) }))
      // Un honorario cuyo alquiler espera al inquilino todavía no se descontó (regla 87).
      .filter(({ importe }) => importe > 0)
      .map(({ f, importe }) => {
        const c = porId.get(f.contratoId)!;
        return {
          conceptoId: f.id,
          categoria: f.categoria as CategoriaPartida,
          ...nombreDePartida(f, l),
          periodo: f.periodo,
          contrato: { id: c.id, codigo: c.codigo, propiedad: direccionDe(c.propiedad) },
          moneda: f.moneda,
          importe,
          liquidacion: f.liquidacion
            ? { id: f.liquidacion.id, numero: f.liquidacion.numero, fecha: f.liquidacion.fecha }
            : null,
        };
      }),
    reclamos: reclamos.map((r) => {
      const c = r.contratoId ? porId.get(r.contratoId) : undefined;
      const costo = new Map<MonedaAlquiler, number>();
      for (const x of r.comprobantes)
        costo.set(
          x.moneda as MonedaAlquiler,
          (aCentavos(costo.get(x.moneda as MonedaAlquiler) ?? 0) + aCentavos(decToNum(x.importe))) /
            100,
        );
      return {
        id: r.id,
        numero: r.numero,
        fecha: diaArgentino(r.createdAt),
        asunto: r.asunto,
        // Regla 68: una fila vieja «cerrado» se lee como resuelto.
        estado: (r.estado === 'cerrado' ? 'resuelto' : r.estado) as EstadoReclamo,
        contrato: c ? { id: c.id, codigo: c.codigo } : null,
        propiedad: c ? direccionDe(c.propiedad) : null,
        proveedor: r.proveedor?.nombre ?? null,
        aCargoDelPropietario: [...costo].map(([moneda, importe]) => ({ moneda, importe })),
      };
    }),
    liquidaciones: [...liquidaciones.values()].sort((a, b) => a.numero - b.numero),
  };
}

/** Un contrato del informe, con su mes a mes (regla 90). */
function contratoDelInforme(
  c: FilaContrato,
  personaId: string,
  filas: Fila[],
  cobradoEl: Map<string, string[]>,
  hoy: string,
): InformePropietarioDto['contratos'][number] {
  const duenos = c.partes.filter((p) => p.papel === 'propietario');
  const suyo = duenos.find((p) => p.personaId === personaId);
  const tramos = c.tramos.map((t) => ({
    numero: t.numero,
    desde: fromDate(t.desde)!,
    importe: t.importe == null ? null : decToNum(t.importe),
  }));
  const alquileres = filas.filter((f) => f.contratoId === c.id && f.categoria === 'alquiler');
  const meses = [...new Set(alquileres.map((f) => f.periodo))].sort().map((periodo) => {
    const delMes = alquileres.filter((f) => f.periodo === periodo);
    const suma = (fn: (e: EstadoDelConcepto) => number) =>
      delMes.reduce((s, f) => s + aCentavos(fn(f.estado)), 0) / 100;
    const liqs = new Map(
      delMes
        .filter((f) => f.liquidacion)
        .map((f) => [
          f.liquidacion!.id,
          { id: f.liquidacion!.id, numero: f.liquidacion!.numero, fecha: f.liquidacion!.fecha },
        ]),
    );
    return {
      periodo,
      alquiler: suma((e) => e.liquidado + e.pendiente + e.espera),
      cobrado: suma((e) => e.liquidado + e.pendiente),
      enEspera: suma((e) => e.espera),
      cobradoEl: cobradoEl.get(`${c.id}|${periodo}`) ?? [],
      liquidaciones: [...liqs.values()].sort((a, b) => a.numero - b.numero),
    };
  });
  return {
    id: c.id,
    codigo: c.codigo,
    moneda: c.moneda as MonedaAlquiler,
    estado: c.estado as EstadoContrato,
    propiedad: direccionDe(c.propiedad),
    inquilinos: c.partes.filter((p) => p.papel === 'inquilino').map((p) => p.persona.nombre),
    porcentaje: duenos.length > 1 && suyo?.porcentaje != null ? decToNum(suyo.porcentaje) : null,
    alquilerVigente: alquilerDeHoy(tramos, hoy),
    proximaIndexacion: c.estado === 'vigente' ? proximoCambio(tramos, hoy) : null,
    vence: fromDate(c.rescindidoEl ?? c.fin)!,
    meses,
  };
}

/** Cómo se llama un descuento: el impuesto, el proveedor (regla 91). */
function nombreDePartida(f: Fila, l: Lectura): { nombre: string; detalle: string } {
  if (f.categoria === 'honorarios') return { nombre: 'Honorarios', detalle: f.descripcion };
  if (f.clave?.startsWith('bol|') && f.claveOrigen) {
    const b = l.boletas.get(f.claveOrigen);
    const nombre = b?.servicio ?? b?.poliza;
    if (nombre) return { nombre, detalle: f.descripcion };
  }
  if (f.clave?.startsWith('prov|') && f.claveOrigen) {
    const c = l.comprobantes.get(f.claveOrigen);
    if (c)
      return {
        nombre: c.proveedor,
        detalle: `${c.descripcion}${c.reclamo != null ? ` · reclamo ${c.reclamo}` : ''}`,
      };
  }
  return { nombre: f.descripcion, detalle: f.descripcion };
}

/** Regla 88: los totales de la tabla, uno por moneda. */
function totalesPorMoneda(filas: InformePropietariosDto['filas']): CadenaInformeDto[] {
  const monedas = [...new Set(filas.flatMap((f) => f.monedas.map((m) => m.moneda)))].sort();
  return monedas.map((moneda) => ({
    moneda,
    ...sumarCadenas(filas.flatMap((f) => f.monedas.filter((m) => m.moneda === moneda))),
  }));
}
