import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DIAS_ANTICIPACION_INDEXACION,
  type BandejaIndexacionDto,
  type ConfirmarIndexacion,
  type EstadoIndiceDto,
  type IndexacionConfirmadaDto,
  type IndexacionDto,
  type IndiceAlquiler,
} from '@vacker/types';
import {
  alertaIndice,
  fechaDelIndice,
  proponerIndexacion,
  sumarDiasIso,
  type IndiceConFuente,
  type PropuestaIndexacion,
} from '@vacker/domain';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import { hoyArgentina } from '../protocolo/protocolo.calc';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

const INCLUIR = {
  contrato: {
    select: {
      id: true,
      codigo: true,
      estado: true,
      ajuste: true,
      indice: true,
      propiedad: { select: { direccion: true, unidad: true } },
      partes: { where: { papel: 'inquilino' }, select: { persona: { select: { nombre: true } } } },
      tramos: { select: { numero: true, desde: true, importe: true }, orderBy: { numero: 'asc' as const } },
    },
  },
} satisfies Prisma.AlqTramoInclude;

type FilaTramo = Prisma.AlqTramoGetPayload<{ include: typeof INCLUIR }>;

/** Los valores cargados del índice, para buscarlos por índice y fecha en memoria. */
type Valores = Map<string, number>;
const clave = (indice: string, fecha: string) => `${indice}:${fecha}`;

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

  async bandeja(hoy = hoyArgentina()): Promise<BandejaIndexacionDto> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqTramo.findMany({
        where: {
          importe: null,
          desde: { lte: toDate(sumarDiasIso(hoy, DIAS_ANTICIPACION_INDEXACION))! },
          contrato: { estado: 'vigente', ajuste: 'indexado' },
        },
        include: INCLUIR,
        orderBy: { desde: 'asc' },
      });
      // Solo el primer tramo sin importe de cada contrato: el siguiente se
      // encadena sobre este (regla 5) y no se puede calcular antes.
      const pendientes = filas.flatMap((f) => {
        const anterior = f.contrato.tramos.find((t) => t.numero === f.numero - 1);
        return anterior?.importe != null ? [{ fila: f, anterior }] : [];
      });

      const valores = await this.cargarValores(
        tx,
        pendientes.map(({ fila, anterior }) => ({ indice: fila.contrato.indice, desdes: [fromDate(anterior.desde)!, fromDate(fila.desde)!] })),
      );
      const indices = await this.estadoIndices(tx, hoy);

      const tramos = pendientes.map(({ fila, anterior }) => {
        const propuesta = proponer(fila, anterior, valores);
        return aDto(fila, decToNum(anterior.importe), propuesta, hoy);
      });
      return { indices, tramos };
    });
  }

  async confirmar(ctx: TenantContext, tramoId: string, dto: ConfirmarIndexacion): Promise<IndexacionConfirmadaDto> {
    return this.db.withTenant(async (tx) => {
      const fila = await tx.alqTramo.findUnique({ where: { id: tramoId }, include: INCLUIR });
      if (!fila) throw new NotFoundException('El tramo no existe.');
      const c = fila.contrato;
      if (c.estado !== 'vigente') throw new BadRequestException('Solo se indexan contratos vigentes.');
      if (c.ajuste !== 'indexado' || !c.indice) throw new BadRequestException('El contrato no se ajusta por índice.');
      if (fila.importe != null) throw new ConflictException(`El tramo ${fila.numero} ya está indexado.`);
      const anterior = c.tramos.find((t) => t.numero === fila.numero - 1);
      if (anterior?.importe == null) {
        throw new BadRequestException(`Primero hay que indexar el tramo ${fila.numero - 1}: este se calcula sobre aquel.`);
      }

      const valores = await this.cargarValores(tx, [{ indice: c.indice, desdes: [fromDate(anterior.desde)!, fromDate(fila.desde)!] }]);
      const propuesta = proponer(fila, anterior, valores);
      const importe = importeAConfirmar(propuesta, dto);

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
      if (count === 0) throw new ConflictException('Otra persona acaba de confirmar este tramo. Recargá la bandeja.');
      return { tramoId, numero: fila.numero, importe };
    });
  }

  /** Una sola consulta para todos los valores que hacen falta, sean cuantos sean los tramos. */
  private async cargarValores(tx: Tx, pedidos: { indice: string | null; desdes: string[] }[]): Promise<Valores> {
    const porIndice = new Map<IndiceConFuente, Set<string>>();
    for (const { indice, desdes } of pedidos) {
      if (indice !== 'ICL' && indice !== 'IPC') continue;
      const set = porIndice.get(indice) ?? new Set<string>();
      for (const d of desdes) set.add(fechaDelIndice(indice, d));
      porIndice.set(indice, set);
    }
    if (porIndice.size === 0) return new Map();
    const filas = await tx.indiceValor.findMany({
      where: { OR: [...porIndice].map(([indice, fechas]) => ({ indice, fecha: { in: [...fechas].map((f) => toDate(f)!) } })) },
    });
    return new Map(filas.map((f) => [clave(f.indice, fromDate(f.fecha)!), Number(f.valor)]));
  }

  /** Hasta dónde llega cada índice y si hay que avisar (regla 8). */
  private async estadoIndices(tx: Tx, hoy: string): Promise<EstadoIndiceDto[]> {
    const grupos = await tx.indiceValor.groupBy({ by: ['indice'], _max: { fecha: true, createdAt: true } });
    return (['ICL', 'IPC'] as const).map((indice) => {
      const g = grupos.find((x) => x.indice === indice);
      const ultimaFecha = fromDate(g?._max.fecha);
      const ultimaCarga = g?._max.createdAt ? hoyArgentina(g._max.createdAt) : null;
      return { indice, ultimaFecha, alerta: alertaIndice(indice, ultimaFecha, ultimaCarga, hoy) };
    });
  }
}

function proponer(fila: FilaTramo, anterior: { desde: Date; importe: Prisma.Decimal | null }, valores: Valores): PropuestaIndexacion {
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
    if (dto.importe == null) throw new BadRequestException('Este índice no tiene fuente automática: cargá el importe.');
    return Math.round(dto.importe);
  }
  if (dto.importe != null && dto.importe !== p.importe) {
    throw new BadRequestException(`El importe sale del índice: $ ${p.importe.toLocaleString('es-AR')}. No se puede confirmar otro.`);
  }
  return p.importe;
}

function aDto(fila: FilaTramo, importeAnterior: number, p: PropuestaIndexacion, hoy: string): IndexacionDto {
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
    vencida: desde <= hoy,
  };
}
