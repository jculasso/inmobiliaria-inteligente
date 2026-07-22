import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { superficieTotal, usdM2 } from '@vacker/domain';
import type { CambiarEstado, CreateTasacion, TasacionFiltro, UpdateTasacion } from '@vacker/types';
import { DomainEventsService } from '../../../common/domain-events.service';
import { SupabaseStorageService } from '../../../common/supabase-storage.service';
import type { TenantContext } from '../../../prisma/tenant-context';
import { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { resolverScope } from '../../tablero/scope.util';
import { decToNum, fromDate, toDate } from '../../tablero/tablero.util';
import { rangoDeAnioMes } from '../fecha.util';

/** Bucket privado de fotos de propiedades — el acceso es siempre por URL firmada. */
const FOTOS_BUCKET = 'tasador-fotos';

export const tasacionInclude = {
  agente: { select: { id: true, nombre: true, email: true, fotoUrl: true } },
  comparables: true,
  fotos: { orderBy: { orden: 'asc' } },
} satisfies Prisma.TasacionInclude;

export type TasacionRow = Prisma.TasacionGetPayload<{ include: typeof tasacionInclude }>;

/**
 * Select mínimo para el pre-check de scope/existencia + las superficies
 * actuales (únicos campos que `update()`/`remove()`/`cambiarEstado()` leen
 * de la fila antes de escribir) — evita el JOIN de comparables/fotos que
 * `tasacionInclude` trae siempre, innecesario acá porque ese resultado no
 * se devuelve al llamador.
 */
const tasacionScopeSelect = {
  id: true,
  tenantId: true,
  agenteId: true,
  estado: true,
  supCubierta: true,
  supSemicubierta: true,
  supDescubierta: true,
} satisfies Prisma.TasacionSelect;

const tasacionResumenSelect = {
  id: true,
  agenteId: true,
  agente: { select: { id: true, nombre: true, fotoUrl: true } },
  cliente: true,
  fecha: true,
  direccion: true,
  tipoPropiedad: true,
  valorRecomendado: true,
  estado: true,
  exclusividad: true,
  motivoNoCaptada: true,
} satisfies Prisma.TasacionSelect;

type TasacionResumenRow = Prisma.TasacionGetPayload<{ select: typeof tasacionResumenSelect }>;

/** CRUD de tasaciones: secciones "Datos del informe", "Características", "Análisis comercial", "Valores" y "Estrategia", más comparables. */
@Injectable()
export class TasacionesService {
  private readonly logger = new Logger(TasacionesService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly events: DomainEventsService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /**
   * Firma las fotos de un DTO (paths del bucket privado → URLs firmadas de vida
   * corta), en una sola llamada de red. `keyDe` tolera registros legacy que
   * guardaban la URL pública completa.
   *
   * NO es crítico para abrir/editar la tasación: si Storage falla o tarda (la
   * firma es un round-trip extra a Supabase, sensible a la latencia cross-region
   * con Render), se devuelve la tasación igual —con las miniaturas rotas— en vez
   * de tumbar toda la pantalla de edición. El warning sí queda en los logs.
   */
  private async firmarFotos<T extends { fotos: { url: string }[] }>(dto: T): Promise<T> {
    if (dto.fotos.length === 0) return dto;
    try {
      const keys = dto.fotos.map((f) => this.storage.keyDe(FOTOS_BUCKET, f.url));
      const firmadas = await this.storage.signedUrls(FOTOS_BUCKET, keys);
      dto.fotos = dto.fotos.map((f, i) => ({ ...f, url: firmadas[i] || f.url }));
    } catch (err) {
      this.logger.warn(
        `No se pudieron firmar las fotos de la tasación: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return dto;
  }

  /** Lista tasaciones del tenant, acotadas por el scope del rol y los filtros. */
  async list(filtro: TasacionFiltro, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const where = await this.whereDe(filtro, ctx, tx);
      const rows = await tx.tasacion.findMany({
        where,
        include: tasacionInclude,
        orderBy: [{ fecha: 'desc' }],
      });
      return rows.map(toDto);
    });
  }

  /**
   * Igual que `list()` pero con un `select` liviano (sin comparables, fotos,
   * análisis ni estrategia comercial) — para vistas de resumen (dashboard)
   * que no necesitan la fila completa.
   */
  async listResumen(filtro: TasacionFiltro, ctx: TenantContext) {
    return this.db.withTenant(async (tx) => {
      const where = await this.whereDe(filtro, ctx, tx);
      const rows = await tx.tasacion.findMany({
        where,
        select: tasacionResumenSelect,
        orderBy: [{ fecha: 'desc' }],
      });
      return rows.map(toResumenDto);
    });
  }

  /** Arma el `where` de listado (filtros + alcance por rol) — compartido por `list()` y `listResumen()`. */
  private async whereDe(
    filtro: TasacionFiltro,
    ctx: TenantContext,
    tx: Prisma.TransactionClient,
  ): Promise<Prisma.TasacionWhereInput> {
    const scope = await resolverScope(ctx, tx);
    const where: Prisma.TasacionWhereInput = {};
    if (filtro.estado) where.estado = filtro.estado;

    const rango = rangoDeAnioMes(filtro.anio, filtro.mes);
    if (rango) where.fecha = rango;

    // Alcance por rol: `agenteId` explícito solo tiene sentido cuando el
    // scope ya es todo el tenant (dirección/admin filtrando un agente puntual).
    if (scope.usuarioIds !== null) {
      where.agenteId = { in: scope.usuarioIds };
    } else if (filtro.agenteId) {
      where.agenteId = filtro.agenteId;
    }
    return where;
  }

  /** Devuelve una tasación por id (RLS + scope), con las fotos firmadas. */
  async getOne(id: string, ctx: TenantContext) {
    const dto = await this.db.withTenant(async (tx) => {
      const row = await tx.tasacion.findUnique({ where: { id }, include: tasacionInclude });
      if (!row) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(row, await resolverScope(ctx, tx));
      return toDto(row);
    });
    // Se firma fuera de la transacción (es una llamada a Storage, no a la base).
    return this.firmarFotos(dto);
  }

  /**
   * Crea una tasación (dueño = quien la crea). El wizard llama esto una sola
   * vez (sección 1, primer guardado) y solo lee `.id` para navegar a la ruta
   * de edición — el `select` liviano evita el JOIN de comparables+fotos+agente
   * que nadie consume acá.
   */
  async create(dto: CreateTasacion, ctx: TenantContext): Promise<{ id: string }> {
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
      return tx.tasacion.create({ data, select: { id: true } });
    });
  }

  /**
   * Edita una tasación. Si vienen `comparables`, reemplazan el set completo.
   * Devuelve solo `{ id }`: el wizard llama esto una vez por sección (hasta
   * 6 veces por edición) y descarta la fila completa — pedirla/devolverla
   * con el JOIN de comparables+fotos en cada guardado intermedio era trabajo
   * de base de datos que nadie consumía.
   */
  async update(id: string, dto: UpdateTasacion, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.tasacion.findUnique({ where: { id }, select: tasacionScopeSelect });
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

      await tx.tasacion.update({ where: { id }, data, select: { id: true } });
      return { id };
    });
  }

  /**
   * Cambia el estado de una tasación (captación). "Captada" exige exclusividad,
   * "No captada" exige motivo — ya validado por `CambiarEstadoSchema`. Registra
   * el cambio en `tasacionEstadoHistorial` y emite los eventos de dominio.
   */
  async cambiarEstado(id: string, dto: CambiarEstado, ctx: TenantContext): Promise<{ id: string }> {
    const estadoAnterior = await this.db.withTenant(async (tx) => {
      // Pre-check liviano (igual que update()/remove()): ni el modal del
      // front ni sus llamadores leen el DTO completo que devolvía esto antes,
      // así que no hace falta el JOIN de comparables/fotos de `tasacionInclude`.
      const actual = await tx.tasacion.findUnique({ where: { id }, select: tasacionScopeSelect });
      if (!actual) throw new NotFoundException('Tasación no encontrada.');
      assertEnScope(actual, await resolverScope(ctx, tx));

      const exclusividad = dto.estado === 'Captada' ? dto.exclusividad : null;
      const motivoNoCaptada = dto.estado === 'No captada' ? dto.motivoNoCaptada : null;
      const detalle = dto.estado === 'Captada' ? exclusividad : motivoNoCaptada ? { motivoNoCaptada } : null;

      // Ya estamos dentro de la transacción que abre `withTenant`: ambas
      // escrituras son atómicas sin necesitar un `$transaction` anidado.
      await tx.tasacion.update({
        where: { id },
        data: {
          estado: dto.estado,
          exclusividad: exclusividad as Prisma.InputJsonValue,
          motivoNoCaptada,
        },
        select: { id: true },
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
      return actual.estado;
    });

    this.events.emit('tasacion_estado_cambiado', {
      tenantId: ctx.tenantId,
      tasacionId: id,
      estadoAnterior,
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

    return { id };
  }

  /** Elimina una tasación (comparables/fotos/historial caen por cascade). */
  async remove(id: string, ctx: TenantContext): Promise<{ id: string }> {
    return this.db.withTenant(async (tx) => {
      const actual = await tx.tasacion.findUnique({ where: { id }, select: { agenteId: true } });
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
  actual?: Pick<TasacionRow, 'supCubierta' | 'supSemicubierta' | 'supDescubierta'>,
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

/** Rechaza el acceso si la tasación no cae en el alcance del rol. */
export function assertEnScope(row: Pick<TasacionRow, 'agenteId'>, scope: { usuarioIds: string[] | null }): void {
  if (scope.usuarioIds === null) return;
  if (!scope.usuarioIds.includes(row.agenteId)) {
    throw new NotFoundException('Tasación no encontrada.');
  }
}

/** Mapea la fila liviana (select de resumen) a la forma JSON de la API. */
export function toResumenDto(row: TasacionResumenRow) {
  return {
    id: row.id,
    agenteId: row.agenteId,
    agente: { id: row.agente.id, nombre: row.agente.nombre, fotoUrl: row.agente.fotoUrl },
    cliente: row.cliente,
    fecha: fromDate(row.fecha)!,
    direccion: row.direccion,
    tipoPropiedad: row.tipoPropiedad,
    valorRecomendado: row.valorRecomendado == null ? null : decToNum(row.valorRecomendado),
    estado: row.estado,
    exclusividad: row.exclusividad,
    motivoNoCaptada: row.motivoNoCaptada,
  };
}

/**
 * '' → null. Algunos enums opcionales quedaron guardados como cadena vacía
 * ("sin setear"); el schema de lectura los espera como null o un valor válido
 * del enum, nunca como '' — una fila así tumbaba toda la respuesta por
 * validación (síntoma: la pantalla de edición no abría). Normalizar acá lo evita.
 */
function vacioANull(v: string | null): string | null {
  return v === '' ? null : v;
}

/** Mapea la fila (Decimal/Date) a la forma JSON de la API. */
export function toDto(row: TasacionRow) {
  return {
    id: row.id,
    codigo: row.codigo,
    agenteId: row.agenteId,
    agente: { id: row.agente.id, nombre: row.agente.nombre, email: row.agente.email, fotoUrl: row.agente.fotoUrl },
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
    estadoInmueble: vacioANull(row.estadoInmueble),
    disposicion: vacioANull(row.disposicion),
    orientacion: vacioANull(row.orientacion),
    cochera: row.cochera,
    balcon: row.balcon,
    terraza: row.terraza,
    patio: row.patio,
    lavadero: row.lavadero,
    piscina: row.piscina,
    amenities: row.amenities,
    detalleAmenities: row.detalleAmenities,
    expensas: row.expensas == null ? null : decToNum(row.expensas),
    aptoCredito: vacioANull(row.aptoCredito),
    documentacion: vacioANull(row.documentacion),
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
        estado: vacioANull(c.estado),
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
    escenarioRecomendado: vacioANull(row.escenarioRecomendado),
    plazoEstimado: vacioANull(row.plazoEstimado),
    estrategiaComercial: row.estrategiaComercial,
    estado: row.estado,
    exclusividad: row.exclusividad,
    motivoNoCaptada: row.motivoNoCaptada,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
