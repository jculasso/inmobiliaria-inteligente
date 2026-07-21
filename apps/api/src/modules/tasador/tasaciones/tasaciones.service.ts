import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { superficieTotal, usdM2 } from '@vacker/domain';
import type { CambiarEstado, CreateTasacion, TasacionFiltro, UpdateTasacion } from '@vacker/types';
import { DomainEventsService } from '../../../common/domain-events.service';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope } from '../../tablero/scope.util';
import { decToNum, fromDate, toDate } from '../../tablero/tablero.util';

export const tasacionInclude = {
  agente: { select: { id: true, nombre: true } },
  comparables: true,
  fotos: { orderBy: { orden: 'asc' } },
} satisfies Prisma.TasacionInclude;

export type TasacionRow = Prisma.TasacionGetPayload<{ include: typeof tasacionInclude }>;

/** CRUD de tasaciones: secciones "Datos del informe", "Características", "Análisis comercial", "Valores" y "Estrategia", más comparables. */
@Injectable()
export class TasacionesService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly events: DomainEventsService,
  ) {}

  /** Lista tasaciones del tenant, acotadas por el scope del rol y los filtros. */
  async list(filtro: TasacionFiltro, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const scope = await resolverScope(ctx, tx);
      const where: Prisma.TasacionWhereInput = {};
      if (filtro.estado) where.estado = filtro.estado;

      const rango = rangoDeFecha(filtro.anio, filtro.mes);
      if (rango) where.fecha = rango;

      // Alcance por rol: `agenteId` explícito solo tiene sentido cuando el
      // scope ya es todo el tenant (dirección/admin filtrando un agente puntual).
      if (scope.usuarioIds !== null) {
        where.agenteId = { in: scope.usuarioIds };
      } else if (filtro.agenteId) {
        where.agenteId = filtro.agenteId;
      }

      const rows = await tx.tasacion.findMany({
        where,
        include: tasacionInclude,
        orderBy: [{ fecha: 'desc' }],
      });
      return rows.map(toDto);
    });
  }

  /** Devuelve una tasación por id (RLS + scope). */
  async getOne(id: string, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const row = await tx.tasacion.findUnique({ where: { id }, include: tasacionInclude });
      if (!row) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(row, await resolverScope(ctx, tx));
      return toDto(row);
    });
  }

  /** Crea una tasación. El dueño (`agenteId`) es siempre quien la crea. */
  async create(dto: CreateTasacion, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const data = {
        tenantId: ctx.tenantId,
        agenteId: ctx.userId,
        cliente: dto.cliente,
        fecha: toDate(dto.fecha)!,
        direccion: dto.direccion,
        barrio: dto.barrio ?? null,
        ciudad: dto.ciudad ?? null,
        tipoOperacion: dto.tipoOperacion,
        ...datosCaracteristicas(dto),
        ...datosValoresYComercial(dto),
        ...(dto.comparables !== undefined
          ? { comparables: { create: dto.comparables.map(({ cochera, ...c }) => ({ ...c, cochera, tenantId: ctx.tenantId })) } }
          : {}),
      } as Prisma.TasacionUncheckedCreateInput;
      const row = await tx.tasacion.create({ data, include: tasacionInclude });
      return toDto(row);
    });
  }

  /** Edita una tasación. Si vienen `comparables`, reemplazan el set completo. */
  async update(id: string, dto: UpdateTasacion, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.tasacion.findUnique({ where: { id }, include: tasacionInclude });
      if (!actual) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(actual, await resolverScope(ctx, tx));

      const data: Prisma.TasacionUpdateInput = {};
      if (dto.cliente !== undefined) data.cliente = dto.cliente;
      if (dto.fecha !== undefined) data.fecha = toDate(dto.fecha)!;
      if (dto.direccion !== undefined) data.direccion = dto.direccion;
      if (dto.barrio !== undefined) data.barrio = dto.barrio ?? null;
      if (dto.ciudad !== undefined) data.ciudad = dto.ciudad ?? null;
      if (dto.tipoOperacion !== undefined) data.tipoOperacion = dto.tipoOperacion;
      Object.assign(data, datosCaracteristicas(dto, actual));
      Object.assign(data, datosValoresYComercial(dto));

      if (dto.comparables !== undefined) {
        await tx.tasacionComparable.deleteMany({ where: { tasacionId: id } });
        data.comparables = {
          create: dto.comparables.map(({ cochera, ...c }) => ({ ...c, cochera, tenantId: actual.tenantId })),
        };
      }

      const row = await tx.tasacion.update({ where: { id }, data, include: tasacionInclude });
      return toDto(row);
    });
  }

  /**
   * Cambia el estado de una tasación (captación). "Captada" exige exclusividad,
   * "No captada" exige motivo — ya validado por `CambiarEstadoSchema`. Registra
   * el cambio en `tasacionEstadoHistorial` y emite los eventos de dominio.
   */
  async cambiarEstado(id: string, dto: CambiarEstado, ctx: TenantContext) {
    const row = await this.db.withTenant(async (tx) => {
      const actual = await tx.tasacion.findUnique({ where: { id }, include: tasacionInclude });
      if (!actual) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(actual, await resolverScope(ctx, tx));

      const exclusividad = dto.estado === 'Captada' ? dto.exclusividad : null;
      const motivoNoCaptada = dto.estado === 'No captada' ? dto.motivoNoCaptada : null;
      const detalle = dto.estado === 'Captada' ? exclusividad : motivoNoCaptada ? { motivoNoCaptada } : null;

      // Ya estamos dentro de la transacción que abre `withTenant`: ambas
      // escrituras son atómicas sin necesitar un `$transaction` anidado.
      const updated = await tx.tasacion.update({
        where: { id },
        data: {
          estado: dto.estado,
          exclusividad: exclusividad as Prisma.InputJsonValue,
          motivoNoCaptada,
        },
        include: tasacionInclude,
      });
      await tx.tasacionEstadoHistorial.create({
        data: {
          tenantId: actual.tenantId,
          tasacionId: id,
          estadoAnterior: actual.estado,
          estadoNuevo: dto.estado,
          usuarioId: ctx.userId,
          detalle: detalle as Prisma.InputJsonValue,
        },
      });
      return { updated, estadoAnterior: actual.estado };
    });

    this.events.emit('tasacion_estado_cambiado', {
      tenantId: ctx.tenantId,
      tasacionId: id,
      estadoAnterior: row.estadoAnterior,
      estadoNuevo: dto.estado,
      usuarioId: ctx.userId,
    });
    if (dto.estado === 'Captada') {
      this.events.emit('tasacion_captada', {
        tenantId: ctx.tenantId,
        tasacionId: id,
        usuarioId: ctx.userId,
        exclusividad: dto.exclusividad,
      });
    }

    return toDto(row.updated);
  }

  /** Elimina una tasación (comparables/fotos/historial caen por cascade). */
  async remove(id: string, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.tasacion.findUnique({ where: { id }, include: tasacionInclude });
      if (!actual) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(actual, await resolverScope(ctx, tx));
      await tx.tasacion.delete({ where: { id } });
      return { id };
    });
  }
}

/**
 * Campos de la sección "Características" + `superficieTotal`, recalculada
 * siempre en el servidor con `@vacker/domain` (nunca se confía en el valor
 * del cliente). Si es un update parcial, usa las superficies actuales como
 * base para lo que no venga en el `dto`.
 */
function datosCaracteristicas(
  dto: Partial<CreateTasacion>,
  actual?: TasacionRow,
): Record<string, unknown> {
  const supCubierta = dto.supCubierta ?? (actual ? decToNum(actual.supCubierta) : 0);
  const supSemicubierta = dto.supSemicubierta ?? (actual ? decToNum(actual.supSemicubierta) : 0);
  const supDescubierta = dto.supDescubierta ?? (actual ? decToNum(actual.supDescubierta) : 0);

  const data: Record<string, unknown> = {
    superficieTotal: superficieTotal({
      cubierta: supCubierta,
      semicubierta: supSemicubierta,
      descubierta: supDescubierta,
    }),
  };
  if (dto.tipoPropiedad !== undefined) data.tipoPropiedad = dto.tipoPropiedad;
  if (dto.supCubierta !== undefined) data.supCubierta = dto.supCubierta;
  if (dto.supSemicubierta !== undefined) data.supSemicubierta = dto.supSemicubierta;
  if (dto.supDescubierta !== undefined) data.supDescubierta = dto.supDescubierta;
  if (dto.supTerreno !== undefined) data.supTerreno = dto.supTerreno ?? null;
  if (dto.dormitorios !== undefined) data.dormitorios = dto.dormitorios ?? null;
  if (dto.banos !== undefined) data.banos = dto.banos ?? null;
  if (dto.toilette !== undefined) data.toilette = dto.toilette ?? null;
  if (dto.ambientes !== undefined) data.ambientes = dto.ambientes ?? null;
  if (dto.antiguedad !== undefined) data.antiguedad = dto.antiguedad ?? null;
  if (dto.estadoInmueble !== undefined) data.estadoInmueble = dto.estadoInmueble ?? null;
  if (dto.disposicion !== undefined) data.disposicion = dto.disposicion ?? null;
  if (dto.orientacion !== undefined) data.orientacion = dto.orientacion ?? null;
  if (dto.cochera !== undefined) data.cochera = dto.cochera;
  if (dto.balcon !== undefined) data.balcon = dto.balcon;
  if (dto.terraza !== undefined) data.terraza = dto.terraza;
  if (dto.patio !== undefined) data.patio = dto.patio;
  if (dto.lavadero !== undefined) data.lavadero = dto.lavadero;
  if (dto.piscina !== undefined) data.piscina = dto.piscina;
  if (dto.amenities !== undefined) data.amenities = dto.amenities;
  if (dto.detalleAmenities !== undefined) data.detalleAmenities = dto.detalleAmenities ?? null;
  if (dto.expensas !== undefined) data.expensas = dto.expensas ?? null;
  if (dto.aptoCredito !== undefined) data.aptoCredito = dto.aptoCredito ?? null;
  if (dto.documentacion !== undefined) data.documentacion = dto.documentacion ?? null;
  return data;
}

/**
 * Secciones "Valores" (5), "Análisis comercial" (3) y "Estrategia" (6). Se
 * persisten tal cual llegan — a diferencia de `superficieTotal`, acá el
 * servidor no recalcula nada (son campos editables por el usuario).
 */
function datosValoresYComercial(dto: Partial<CreateTasacion>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.valorMinimo !== undefined) data.valorMinimo = dto.valorMinimo ?? null;
  if (dto.valorRecomendado !== undefined) data.valorRecomendado = dto.valorRecomendado ?? null;
  if (dto.valorAspiracional !== undefined) data.valorAspiracional = dto.valorAspiracional ?? null;
  if (dto.margenNegociacion !== undefined) data.margenNegociacion = dto.margenNegociacion ?? null;
  if (dto.escenarioRecomendado !== undefined) data.escenarioRecomendado = dto.escenarioRecomendado ?? null;
  if (dto.plazoEstimado !== undefined) data.plazoEstimado = dto.plazoEstimado ?? null;
  if (dto.analisisComercial !== undefined) {
    data.analisisComercial = (dto.analisisComercial ?? null) as Prisma.InputJsonValue;
  }
  if (dto.estrategiaComercial !== undefined) {
    data.estrategiaComercial = (dto.estrategiaComercial ?? null) as Prisma.InputJsonValue;
  }
  return data;
}

/** Rango `[inicio, fin)` sobre `fecha` para un año completo o un mes puntual. */
function rangoDeFecha(anio?: number, mes?: number): Prisma.DateTimeFilter | undefined {
  if (anio == null) return undefined;
  if (mes != null) {
    return { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) };
  }
  return { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) };
}

/** Rechaza el acceso si la tasación no cae en el alcance del rol. */
export function assertEnScope(row: TasacionRow, scope: { usuarioIds: string[] | null }): void {
  if (scope.usuarioIds === null) return;
  if (!scope.usuarioIds.includes(row.agenteId)) {
    throw new NotFoundException('Tasación no encontrada.');
  }
}

/** Mapea la fila (Decimal/Date) a la forma JSON de la API. */
export function toDto(row: TasacionRow) {
  return {
    id: row.id,
    codigo: row.codigo,
    agenteId: row.agenteId,
    agente: { id: row.agente.id, nombre: row.agente.nombre },
    cliente: row.cliente,
    fecha: fromDate(row.fecha)!,
    direccion: row.direccion,
    barrio: row.barrio,
    ciudad: row.ciudad,
    tipoOperacion: row.tipoOperacion,
    tipoPropiedad: row.tipoPropiedad,
    supCubierta: decToNum(row.supCubierta),
    supSemicubierta: decToNum(row.supSemicubierta),
    supDescubierta: decToNum(row.supDescubierta),
    supTerreno: row.supTerreno == null ? null : decToNum(row.supTerreno),
    superficieTotal: decToNum(row.superficieTotal),
    dormitorios: row.dormitorios,
    banos: row.banos,
    toilette: row.toilette,
    ambientes: row.ambientes,
    antiguedad: row.antiguedad,
    estadoInmueble: row.estadoInmueble,
    disposicion: row.disposicion,
    orientacion: row.orientacion,
    cochera: row.cochera,
    balcon: row.balcon,
    terraza: row.terraza,
    patio: row.patio,
    lavadero: row.lavadero,
    piscina: row.piscina,
    amenities: row.amenities,
    detalleAmenities: row.detalleAmenities,
    expensas: row.expensas == null ? null : decToNum(row.expensas),
    aptoCredito: row.aptoCredito,
    documentacion: row.documentacion,
    comparables: row.comparables.map((c) => {
      const superficie = decToNum(c.superficie);
      const precio = decToNum(c.precio);
      return {
        id: c.id,
        direccion: c.direccion,
        superficie,
        precio,
        dormitorios: c.dormitorios,
        banos: c.banos,
        cochera: c.cochera,
        estado: c.estado,
        link: c.link,
        observaciones: c.observaciones,
        usdM2: usdM2({ superficie, precio }),
      };
    }),
    fotos: row.fotos.map((f) => ({ id: f.id, url: f.url, orden: f.orden })),
    analisisComercial: row.analisisComercial,
    valorMinimo: row.valorMinimo == null ? null : decToNum(row.valorMinimo),
    valorRecomendado: row.valorRecomendado == null ? null : decToNum(row.valorRecomendado),
    valorAspiracional: row.valorAspiracional == null ? null : decToNum(row.valorAspiracional),
    margenNegociacion: row.margenNegociacion == null ? null : Number(row.margenNegociacion),
    escenarioRecomendado: row.escenarioRecomendado,
    plazoEstimado: row.plazoEstimado,
    estrategiaComercial: row.estrategiaComercial,
    estado: row.estado,
    exclusividad: row.exclusividad,
    motivoNoCaptada: row.motivoNoCaptada,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
