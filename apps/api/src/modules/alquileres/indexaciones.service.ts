import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DIAS_ANTICIPACION_INDEXACION,
  type BandejaIndexacionDto,
  type ConfirmarIndexacion,
  type VistaPreviaDiferenciasDto,
  type EstadoIndiceDto,
  type IndexacionConfirmadaDto,
  type IndexacionDto,
  type IndiceAlquiler,
} from '@vacker/types';
import {
  alertaIndice,
  esTramoAnterior,
  proponerIndexacion,
  sumarDiasIso,
  type PropuestaIndexacion,
} from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { tomarCandados } from './candados';
import { plata, registrarEventos } from './historial';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { claveDeValor, valoresDeIndices, type ValoresDeIndices } from './esperas-indice';
import { diferenciasFinales } from './liquidacion-final';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const INCLUIR = {
  contrato: {
    select: {
      id: true,
      codigo: true,
      moneda: true,
      estado: true,
      ajuste: true,
      indice: true,
      propiedad: { select: { direccion: true, unidad: true } },
      partes: { where: { papel: 'inquilino' }, select: { persona: { select: { nombre: true } } } },
      tramos: {
        select: { numero: true, desde: true, importe: true },
        orderBy: { numero: 'asc' as const },
      },
    },
  },
} satisfies Prisma.AlqTramoInclude;

type FilaTramo = Prisma.AlqTramoGetPayload<{ include: typeof INCLUIR }>;

/** Los valores cargados del índice, para buscarlos por índice y fecha en memoria. */
type Valores = ValoresDeIndices;
const clave = claveDeValor;

/**
 * La bandeja «a indexar» (spec alquileres-fase-1.md, reglas 5 a 7).
 *
 * El sistema **propone** el importe de cada tramo y una persona lo confirma
 * (regla 6). Al confirmar, la API vuelve a calcular con los valores cargados:
 * lo que se guarda nunca es un número que mandó el navegador, salvo para
 * Casa Propia, que no tiene fuente.
 *
 * Los índices se leen dentro de withTenant: `indice_valor` tiene una policy
 * de lectura para el rol de la API.
 */
@Injectable()
export class IndexacionesService {
  constructor(private readonly db: TenantPrismaService) {}

  /** `dias`: cuánto adelante mira. La bandeja usa 30; el tablero, 60 (como Gexion). */
  async bandeja(
    hoy = hoyArgentina(),
    dias = DIAS_ANTICIPACION_INDEXACION,
  ): Promise<BandejaIndexacionDto> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqTramo.findMany({
        where: {
          importe: null,
          desde: { lte: toDate(sumarDiasIso(hoy, dias))! },
          contrato: { estado: 'vigente', ajuste: 'indexado' },
        },
        include: INCLUIR,
        orderBy: { desde: 'asc' },
      });
      // Solo el primer tramo sin importe de cada contrato: el siguiente se
      // encadena sobre este (regla 5) y no se puede calcular antes.
      // Tampoco los de antes de que se administrara un contrato tomado en
      // curso (regla 106): son historia, no indexaciones pendientes.
      const pendientes = filas.flatMap((f) => {
        const anterior = f.contrato.tramos.find((t) => t.numero === f.numero - 1);
        return anterior?.importe != null && !esAnterior(f) ? [{ fila: f, anterior }] : [];
      });

      const valores = await this.cargarValores(
        tx,
        pendientes.map(({ fila, anterior }) => ({
          indice: fila.contrato.indice,
          desdes: [fromDate(anterior.desde)!, fromDate(fila.desde)!],
        })),
      );
      const indices = await this.estadoIndices(tx, hoy);

      const tramos = pendientes.map(({ fila, anterior }) => {
        const propuesta = proponer(fila, anterior, valores);
        return aDto(fila, decToNum(anterior.importe), propuesta, hoy);
      });
      return { indices, tramos };
    });
  }

  async confirmar(
    ctx: TenantContext,
    tramoId: string,
    dto: ConfirmarIndexacion,
    hoy = hoyArgentina(),
  ): Promise<IndexacionConfirmadaDto> {
    return this.db.withTenant(async (tx) => {
      // El mismo candado que «Generar el período»: las finales se calculan
      // sobre las parciales que existen, así que una generación del mes no
      // puede estar guardando otra mientras tanto (regla 131).
      await tomarCandados(tx, ctx.tenantId, 'alq_generacion');
      const { fila, anterior, propuesta, importe } = await this.aConfirmar(tx, tramoId, dto);
      const c = fila.contrato;

      // `importe: null` en el where: si otra persona confirmó mientras tanto,
      // no se pisa su importe.
      const { count } = await tx.alqTramo.updateMany({
        where: { id: tramoId, importe: null },
        data: {
          importe,
          importePropuesto: propuesta.estado === 'lista' ? propuesta.importe : null,
          indiceBase: propuesta.estado === 'lista' ? propuesta.valorBase : null,
          indiceRequerido: propuesta.estado === 'lista' ? propuesta.valorRequerido : null,
          confirmadoEl: new Date(),
          confirmadoPorId: ctx.userId,
        },
      });
      if (count === 0)
        throw new ConflictException(
          'Otra persona acaba de confirmar este tramo. Recargá la bandeja.',
        );
      await registrarEventos(tx, ctx, {
        entidad: 'tramo',
        entidadId: tramoId,
        contratoId: c.id,
        accion: 'indexacion',
        resumen: `Indexó el tramo ${fila.numero} (${c.indice}): ${plata(decToNum(anterior.importe), c.moneda)} → ${plata(importe, c.moneda)}`,
      });
      // Regla 131: los meses que se cobraron como parcial reciben su
      // diferencia, en el mismo mes y en la misma transacción.
      const diferencias = await diferenciasFinales(tx, {
        tenantId: ctx.tenantId,
        contratoId: c.id,
        tramo: fila.numero,
        importe,
        hoy,
        crear: { ctx },
      });
      return { tramoId, numero: fila.numero, importe, diferencias };
    });
  }

  /**
   * Regla 137: lo que generaría confirmar el tramo, sin confirmarlo. Las
   * mismas validaciones y el mismo importe que la confirmación: lo que se
   * muestra es lo que se va a generar.
   */
  async previsualizar(
    ctx: TenantContext,
    tramoId: string,
    dto: ConfirmarIndexacion,
    hoy = hoyArgentina(),
  ): Promise<VistaPreviaDiferenciasDto> {
    return this.db.withTenant(async (tx) => {
      const { fila, importe } = await this.aConfirmar(tx, tramoId, dto);
      const diferencias = await diferenciasFinales(tx, {
        tenantId: ctx.tenantId,
        contratoId: fila.contrato.id,
        tramo: fila.numero,
        importe,
        hoy,
        crear: null,
      });
      // Siempre un objeto: un `null` suelto viaja como cuerpo vacío.
      return { diferencias };
    });
  }

  /** El tramo, su anterior y el importe que se confirmaría, con todas las validaciones (regla 6). */
  private async aConfirmar(tx: Tx, tramoId: string, dto: ConfirmarIndexacion) {
    const fila = await tx.alqTramo.findUnique({ where: { id: tramoId }, include: INCLUIR });
    if (!fila) throw new NotFoundException('El tramo no existe.');
    const c = fila.contrato;
    if (c.estado !== 'vigente')
      throw new BadRequestException('Solo se indexan contratos vigentes.');
    if (c.ajuste !== 'indexado' || !c.indice)
      throw new BadRequestException('El contrato no se ajusta por índice.');
    if (fila.importe != null)
      throw new ConflictException(`El tramo ${fila.numero} ya está indexado.`);
    if (esAnterior(fila))
      throw new BadRequestException(
        `El tramo ${fila.numero} es de antes de que se administrara el contrato: no se indexa.`,
      );
    const anterior = c.tramos.find((t) => t.numero === fila.numero - 1);
    if (anterior?.importe == null) {
      throw new BadRequestException(
        `Primero hay que indexar el tramo ${fila.numero - 1}: este se calcula sobre aquel.`,
      );
    }
    const valores = await this.cargarValores(tx, [
      { indice: c.indice, desdes: [fromDate(anterior.desde)!, fromDate(fila.desde)!] },
    ]);
    const propuesta = proponer(fila, anterior, valores);
    return { fila, anterior, propuesta, importe: importeAConfirmar(propuesta, dto) };
  }

  /** Una sola consulta para todos los valores que hacen falta (la misma que usa la generación del mes). */
  private cargarValores(
    tx: Tx,
    pedidos: { indice: string | null; desdes: string[] }[],
  ): Promise<Valores> {
    return valoresDeIndices(tx, pedidos);
  }

  /** Hasta dónde llega cada índice y si hay que avisar (regla 8). */
  private async estadoIndices(tx: Tx, hoy: string): Promise<EstadoIndiceDto[]> {
    const grupos = await tx.indiceValor.groupBy({
      by: ['indice'],
      _max: { fecha: true, createdAt: true },
    });
    return (['ICL', 'IPC'] as const).map((indice) => {
      const g = grupos.find((x) => x.indice === indice);
      const ultimaFecha = fromDate(g?._max.fecha);
      const ultimaCarga = g?._max.createdAt ? hoyArgentina(g._max.createdAt) : null;
      return { indice, ultimaFecha, alerta: alertaIndice(indice, ultimaFecha, ultimaCarga, hoy) };
    });
  }
}

/** Regla 106: un tramo sin importe con uno posterior que sí lo tiene es historia. */
function esAnterior(fila: FilaTramo): boolean {
  const orden = fila.contrato.tramos.map((t) => ({
    numero: t.numero,
    importe: t.importe == null ? null : decToNum(t.importe),
  }));
  return esTramoAnterior(
    orden,
    orden.findIndex((t) => t.numero === fila.numero),
  );
}

function proponer(
  fila: FilaTramo,
  anterior: { desde: Date; importe: Prisma.Decimal | null },
  valores: Valores,
): PropuestaIndexacion {
  return proponerIndexacion(
    fila.contrato.indice ?? '',
    { desde: fromDate(anterior.desde)!, importe: decToNum(anterior.importe) },
    { desde: fromDate(fila.desde)! },
    (indice, fecha) => valores.get(clave(indice, fecha)),
  );
}

/**
 * Regla 6: qué importe se guarda. Si el índice tiene fuente, el que calcula la
 * API; uno distinto en el pedido se rechaza en vez de ignorarse, para que
 * nadie crea que confirmó un número que no es el que quedó.
 */
function importeAConfirmar(p: PropuestaIndexacion, dto: ConfirmarIndexacion): number {
  if (p.estado === 'pendiente_indice') {
    throw new BadRequestException(`Todavía no se puede indexar: falta ${p.falta.join(' y ')}.`);
  }
  if (p.estado === 'manual') {
    if (dto.importe == null)
      throw new BadRequestException('Este índice no tiene fuente automática: cargá el importe.');
    return Math.round(dto.importe);
  }
  if (dto.importe != null && dto.importe !== p.importe) {
    throw new BadRequestException(
      `El importe sale del índice: $ ${p.importe.toLocaleString('es-AR')}. No se puede confirmar otro.`,
    );
  }
  return p.importe;
}

function aDto(
  fila: FilaTramo,
  importeAnterior: number,
  p: PropuestaIndexacion,
  hoy: string,
): IndexacionDto {
  const desde = fromDate(fila.desde)!;
  return {
    tramoId: fila.id,
    contrato: {
      id: fila.contrato.id,
      codigo: fila.contrato.codigo,
      direccion: fila.contrato.propiedad.direccion,
      unidad: fila.contrato.propiedad.unidad,
    },
    inquilinos: fila.contrato.partes.map((x) => x.persona.nombre),
    indice: (fila.contrato.indice ?? 'CCP') as IndiceAlquiler,
    numero: fila.numero,
    desde,
    hasta: fromDate(fila.hasta)!,
    importeAnterior,
    estado: p.estado,
    fechaBase: p.estado === 'manual' ? null : p.fechaBase,
    valorBase: p.estado === 'lista' ? p.valorBase : null,
    fechaRequerida: p.estado === 'manual' ? null : p.fechaRequerida,
    valorRequerido: p.estado === 'lista' ? p.valorRequerido : null,
    importePropuesto: p.estado === 'lista' ? p.importe : null,
    falta: p.estado === 'pendiente_indice' ? p.falta : [],
    // Regla 7: si el índice todavía no se publicó, no está vencida: espera el índice.
    vencida: desde <= hoy && p.estado !== 'pendiente_indice',
  };
}
