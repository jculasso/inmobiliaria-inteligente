import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PLANTILLA_ACCIONES,
  type ArchivarProtocolo,
  type CandidataDto,
  type IniciarProtocolo,
  type ProtocoloDto,
  type ProtocoloFiltro,
  type ProtocoloKpis,
  type ProtocoloResumenDto,
  type UpdateAccion,
  type UpdateProtocolo,
  LIMITE_LISTA_CON_SONDA,
} from '@vacker/types';
import { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { scopeDePermiso, scopeDeVista } from '../tablero/scope.util';
import { rangoDeAnioMesTrimestre } from '../tasador/fecha.util';
import { decToNum, fromDate, toDate } from '../tablero/tablero.util';
import {
  avance,
  calcularAlertas,
  calcularEmbudo,
  diasPublicada,
  estaAtrasada,
  fechaPrevistaDeSemana,
  hoyArgentina,
  semanaActual,
  type AccionCalc,
} from './protocolo.calc';

/** Bucket privado de fotos de propiedades — el acceso es siempre por URL firmada. */
const FOTOS_BUCKET = 'tasador-fotos';

/** Techo defensivo de filas por listado, igual que en Tasador/Tablero. */

/** Solo las tasaciones captadas entran al protocolo. */
const ESTADO_CAPTADA = 'Captada';

const protocoloInclude = {
  agente: { select: { id: true, nombre: true, email: true, telefono: true, fotoUrl: true } },
  acciones: { orderBy: [{ semana: 'asc' }, { orden: 'asc' }] },
  tasacion: {
    select: {
      id: true,
      direccion: true,
      barrio: true,
      ciudad: true,
      tipoPropiedad: true,
      tipoOperacion: true,
      superficieTotal: true,
      dormitorios: true,
      banos: true,
      valorRecomendado: true,
      fotos: { orderBy: { orden: 'asc' }, take: 1, select: { url: true } },
    },
  },
} satisfies Prisma.ProtocoloInclude;

type ProtocoloRow = Prisma.ProtocoloGetPayload<{ include: typeof protocoloInclude }>;

@Injectable()
export class ProtocolosService {
  private readonly logger = new Logger(ProtocolosService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  /**
   * Tasaciones captadas que todavía no arrancaron el protocolo — la bandeja de
   * entrada del módulo. Acotadas por el alcance del rol.
   */
  async listarCandidatas(verTodo: boolean, ctx: TenantContext): Promise<CandidataDto[]> {
    const filas = await this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, verTodo);
      return tx.tasacion.findMany({
        where: {
          estado: ESTADO_CAPTADA,
          protocolo: { is: null },
          ...(scope.usuarioIds !== null ? { agenteId: { in: scope.usuarioIds } } : {}),
        },
        orderBy: { fecha: 'desc' },
        take: LIMITE_LISTA_CON_SONDA,
        select: {
          id: true,
          codigo: true,
          direccion: true,
          barrio: true,
          ciudad: true,
          tipoPropiedad: true,
          tipoOperacion: true,
          cliente: true,
          fecha: true,
          valorRecomendado: true,
          exclusividad: true,
          agente: { select: { id: true, nombre: true, email: true, telefono: true, fotoUrl: true } },
          fotos: { orderBy: { orden: 'asc' }, take: 1, select: { url: true } },
        },
      });
    }, ctx);

    const dtos: CandidataDto[] = filas.map((t) => ({
      tasacionId: t.id,
      codigo: t.codigo,
      direccion: t.direccion,
      barrio: t.barrio,
      ciudad: t.ciudad,
      tipoPropiedad: t.tipoPropiedad,
      tipoOperacion: t.tipoOperacion,
      cliente: t.cliente,
      fecha: fromDate(t.fecha) ?? hoyArgentina(),
      valorRecomendado: t.valorRecomendado == null ? null : decToNum(t.valorRecomendado),
      diasExclusividad: diasDeExclusividad(t.exclusividad),
      fotoUrl: t.fotos[0]?.url ?? null,
      agente: t.agente,
    }));
    return this.firmarPortadas(dtos);
  }

  /**
   * Inicia el protocolo de una tasación captada: crea la ficha y copia las 29
   * acciones de la plantilla, fechadas según la semana que les toca.
   */
  async iniciar(dto: IniciarProtocolo, ctx: TenantContext): Promise<ProtocoloDto> {
    const fechaInicio = dto.fechaInicio ?? hoyArgentina();

    const row = await this.db.withTenant(async (tx) => {
      const scope = await scopeDePermiso(ctx, tx);
      const tasacion = await tx.tasacion.findUnique({
        where: { id: dto.tasacionId },
        select: { id: true, estado: true, agenteId: true, cliente: true, protocolo: { select: { id: true } } },
      });

      // RLS ya acotó al tenant; acá se valida el alcance del rol y el estado.
      if (!tasacion) throw new NotFoundException('Tasación no encontrada.');
      if (scope.usuarioIds !== null && !scope.usuarioIds.includes(tasacion.agenteId)) {
        throw new NotFoundException('Tasación no encontrada.');
      }
      if (tasacion.estado !== ESTADO_CAPTADA) {
        throw new BadRequestException('Solo se puede iniciar el protocolo de una tasación captada.');
      }
      if (tasacion.protocolo) {
        throw new ConflictException('Esta propiedad ya tiene un protocolo iniciado.');
      }

      await tx.protocolo.create({
        data: {
          tenantId: ctx.tenantId,
          tasacionId: tasacion.id,
          // El responsable es el agente de la tasación, no quien aprieta el botón.
          agenteId: tasacion.agenteId,
          fechaInicio: toDate(fechaInicio)!,
          precioPublicado: dto.precioPublicado ?? null,
          moneda: dto.moneda,
          propietarioNombre: dto.propietarioNombre ?? tasacion.cliente,
          propietarioTelefono: dto.propietarioTelefono ?? null,
          propietarioEmail: dto.propietarioEmail || null,
          vencimientoAutorizacion: toDate(dto.vencimientoAutorizacion),
          acciones: {
            create: PLANTILLA_ACCIONES.map((a, i) => ({
              tenantId: ctx.tenantId,
              semana: a.semana,
              orden: i,
              clave: a.clave,
              titulo: a.titulo,
              fechaPrevista: toDate(fechaPrevistaDeSemana(fechaInicio, a.semana)),
            })),
          },
        },
      });

      // Se relee con el include completo: `create` con nested writes no puede
      // devolver el mismo shape que el resto de los endpoints.
      return tx.protocolo.findUniqueOrThrow({
        where: { tasacionId: tasacion.id },
        include: protocoloInclude,
      });
    }, ctx);

    return this.firmarPortada(toDto(row));
  }

  /** Lista los protocolos del tenant, acotados por scope y filtros. */
  async list(filtro: ProtocoloFiltro, ctx: TenantContext): Promise<ProtocoloResumenDto[]> {
    const filas = await this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, filtro.verTodo);
      const where: Prisma.ProtocoloWhereInput = {};
      if (filtro.estado) where.estado = filtro.estado;
      if (scope.usuarioIds !== null) where.agenteId = { in: scope.usuarioIds };
      const rango = rangoDeAnioMesTrimestre(filtro.anio, filtro.mes, filtro.trimestre);
      if (rango) where.fechaInicio = rango;
      return tx.protocolo.findMany({
        where,
        orderBy: { fechaInicio: 'desc' },
        take: LIMITE_LISTA_CON_SONDA,
        include: protocoloInclude,
      });
    }, ctx);

    return this.firmarPortadas(filas.map((f) => toResumen(f)));
  }

  async getOne(id: string, ctx: TenantContext): Promise<ProtocoloDto> {
    const row = await this.db.withTenant(async (tx) => {
      const scope = await scopeDePermiso(ctx, tx);
      const p = await tx.protocolo.findUnique({ where: { id }, include: protocoloInclude });
      if (!p) throw new NotFoundException('Protocolo no encontrado.');
      if (scope.usuarioIds !== null && !scope.usuarioIds.includes(p.agenteId)) {
        throw new NotFoundException('Protocolo no encontrado.');
      }
      return p;
    }, ctx);

    return this.firmarPortada(toDto(row));
  }

  /** Actualiza cabecera, métricas comerciales y análisis de la semana 5. */
  async update(id: string, dto: UpdateProtocolo, ctx: TenantContext): Promise<ProtocoloDto> {
    const row = await this.db.withTenant(async (tx) => {
      const actual = await this.exigirAcceso(id, tx, ctx);
      this.exigirVersion(actual.updatedAt, dto.version);

      const data: Prisma.ProtocoloUpdateInput = {};
      if (dto.precioPublicado !== undefined) data.precioPublicado = dto.precioPublicado;
      if (dto.moneda !== undefined) data.moneda = dto.moneda;
      if (dto.propietarioNombre !== undefined) data.propietarioNombre = dto.propietarioNombre;
      if (dto.propietarioTelefono !== undefined) data.propietarioTelefono = dto.propietarioTelefono;
      if (dto.propietarioEmail !== undefined) data.propietarioEmail = dto.propietarioEmail;
      if (dto.vencimientoAutorizacion !== undefined) {
        data.vencimientoAutorizacion = toDate(dto.vencimientoAutorizacion);
      }
      if (dto.consultas !== undefined) data.consultas = dto.consultas;
      if (dto.consultasCalificadas !== undefined) data.consultasCalificadas = dto.consultasCalificadas;
      if (dto.visitas !== undefined) data.visitas = dto.visitas;
      if (dto.interesadosActivos !== undefined) data.interesadosActivos = dto.interesadosActivos;
      if (dto.ofertas !== undefined) data.ofertas = dto.ofertas;
      if (dto.devolucionesMercado !== undefined) data.devolucionesMercado = dto.devolucionesMercado;
      if (dto.objeciones !== undefined) data.objeciones = dto.objeciones;
      if (dto.recomendacion !== undefined) data.recomendacion = dto.recomendacion;
      if (dto.decisionPropietario !== undefined) data.decisionPropietario = dto.decisionPropietario;
      if (dto.proximasAcciones !== undefined) data.proximasAcciones = dto.proximasAcciones;

      return tx.protocolo.update({ where: { id }, data, include: protocoloInclude });
    }, ctx);

    return toDto(row);
  }

  /** Actualiza una acción del checklist. */
  async updateAccion(
    id: string,
    accionId: string,
    dto: UpdateAccion,
    ctx: TenantContext,
  ): Promise<ProtocoloDto> {
    const row = await this.db.withTenant(async (tx) => {
      // El acceso y la pertenencia de la acción se validan en una sola lectura:
      // cada round trip extra a la base pesa (Render y Supabase están en
      // regiones distintas) y esto se dispara con cada tilde del checklist.
      const accion = await tx.protocoloAccion.findUnique({
        where: { id: accionId },
        select: {
          protocoloId: true,
          fechaRealizada: true,
          protocolo: { select: { agenteId: true, updatedAt: true } },
        },
      });
      if (!accion || accion.protocoloId !== id) {
        throw new NotFoundException('Acción no encontrada.');
      }
      const scope = await scopeDePermiso(ctx, tx);
      if (scope.usuarioIds !== null && !scope.usuarioIds.includes(accion.protocolo.agenteId)) {
        throw new NotFoundException('Protocolo no encontrado.');
      }
      this.exigirVersion(accion.protocolo.updatedAt, dto.version);

      const data: Prisma.ProtocoloAccionUpdateInput = {};
      if (dto.estado !== undefined) data.estado = dto.estado;
      if (dto.fechaPrevista !== undefined) data.fechaPrevista = toDate(dto.fechaPrevista);
      if (dto.fechaRealizada !== undefined) data.fechaRealizada = toDate(dto.fechaRealizada);
      if (dto.observaciones !== undefined) data.observaciones = dto.observaciones;
      if (dto.resultado !== undefined) data.resultado = dto.resultado;
      if (dto.evidencia !== undefined) data.evidencia = dto.evidencia;

      // Marcar "realizada" sin fecha completa con hoy (como el prototipo): la
      // fecha alimenta el informe, y pedirla aparte se olvida siempre.
      if (dto.estado === 'realizada' && dto.fechaRealizada === undefined && !accion.fechaRealizada) {
        data.fechaRealizada = toDate(hoyArgentina());
      }

      await tx.protocoloAccion.update({ where: { id: accionId }, data });
      // `updatedAt` del protocolo alimenta la alerta de inactividad.
      return tx.protocolo.update({
        where: { id },
        data: { updatedAt: new Date() },
        include: protocoloInclude,
      });
    }, ctx);

    return toDto(row);
  }

  /** Archiva la propiedad (vendida, retirada, autorización vencida u otro motivo). */
  async archivar(id: string, dto: ArchivarProtocolo, ctx: TenantContext): Promise<ProtocoloDto> {
    const row = await this.db.withTenant(async (tx) => {
      const actual = await this.exigirAcceso(id, tx, ctx);
      if (actual.estado === 'archivada') {
        throw new ConflictException('Esta propiedad ya está archivada.');
      }
      return tx.protocolo.update({
        where: { id },
        data: {
          estado: 'archivada',
          archivadoEn: toDate(dto.fecha ?? hoyArgentina()),
          motivoArchivo: dto.motivo,
          observacionArchivo: dto.observacion ?? null,
        },
        include: protocoloInclude,
      });
    }, ctx);

    return toDto(row);
  }

  /** Reabre una propiedad archivada por error. */
  async desarchivar(id: string, ctx: TenantContext): Promise<ProtocoloDto> {
    const row = await this.db.withTenant(async (tx) => {
      await this.exigirAcceso(id, tx, ctx);
      return tx.protocolo.update({
        where: { id },
        data: { estado: 'activa', archivadoEn: null, motivoArchivo: null, observacionArchivo: null },
        include: protocoloInclude,
      });
    }, ctx);

    return toDto(row);
  }

  /** KPIs de cabecera del dashboard del módulo. */
  async kpis(verTodo: boolean, ctx: TenantContext): Promise<ProtocoloKpis> {
    return this.db.withTenant(async (tx) => {
      const scope = await scopeDeVista(ctx, tx, verTodo);
      const porAgente = scope.usuarioIds !== null ? { agenteId: { in: scope.usuarioIds } } : {};

      const [protocolos, captadasSinIniciar] = await Promise.all([
        tx.protocolo.findMany({
          where: porAgente,
          take: LIMITE_LISTA_CON_SONDA,
          include: { acciones: { select: { semana: true, estado: true, fechaPrevista: true } } },
        }),
        tx.tasacion.count({
          where: { estado: ESTADO_CAPTADA, protocolo: { is: null }, ...porAgente },
        }),
      ]);

      const activas = protocolos.filter((p) => p.estado === 'activa');
      const hoy = hoyArgentina();
      const alertasCriticas = activas.filter((p) =>
        p.acciones.some((a) => estaAtrasada(aAccionCalc(a), hoy)),
      ).length;
      const avancePromedio =
        activas.length === 0
          ? 0
          : activas.reduce((s, p) => s + avance(p.acciones.map(aAccionCalc)), 0) / activas.length;

      return {
        activas: activas.length,
        alertasCriticas,
        avancePromedio,
        captadasSinIniciar,
        archivadas: protocolos.length - activas.length,
      };
    }, ctx);
  }

  /**
   * Rechaza el guardado si otra persona (u otra pestaña) modificó la ficha
   * después de que este cliente la cargó. Sin esto el último en guardar pisaba
   * al anterior en silencio — el caso feo son los contadores, que viajan como
   * valor absoluto y podían retroceder sin que nadie se enterara.
   */
  private exigirVersion(actual: Date, version: string | undefined): void {
    if (!version) return;
    if (actual.toISOString() !== version) {
      throw new ConflictException(
        'Otra persona actualizó esta propiedad mientras la editabas. Refrescá para ver los cambios y volvé a aplicar el tuyo.',
      );
    }
  }

  /**
   * Verifica que el protocolo exista y esté dentro del alcance del rol.
   * Devuelve el estado actual para las validaciones que lo necesiten.
   */
  private async exigirAcceso(
    id: string,
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
  ): Promise<{ estado: string; updatedAt: Date }> {
    const scope = await scopeDePermiso(ctx, tx);
    const p = await tx.protocolo.findUnique({
      where: { id },
      select: { agenteId: true, estado: true, updatedAt: true },
    });
    if (!p) throw new NotFoundException('Protocolo no encontrado.');
    if (scope.usuarioIds !== null && !scope.usuarioIds.includes(p.agenteId)) {
      throw new NotFoundException('Protocolo no encontrado.');
    }
    return { estado: p.estado, updatedAt: p.updatedAt };
  }

  /**
   * Firma la foto de portada (bucket privado). Igual que en Tasador: si Storage
   * falla no se tumba la pantalla, se devuelve con la miniatura rota.
   */
  private async firmarPortadas<T extends { fotoUrl: string | null }>(items: T[]): Promise<T[]>;
  private async firmarPortadas<T extends { propiedad: { fotoUrl: string | null } }>(items: T[]): Promise<T[]>;
  private async firmarPortadas(items: { fotoUrl?: string | null; propiedad?: { fotoUrl: string | null } }[]) {
    const refs = items
      .map((i) => (i.propiedad ? i.propiedad : i))
      .filter((r): r is { fotoUrl: string } => typeof r.fotoUrl === 'string' && r.fotoUrl.length > 0);
    if (refs.length === 0) return items;
    try {
      const keys = refs.map((r) => this.storage.keyDe(FOTOS_BUCKET, r.fotoUrl));
      const firmadas = await this.storage.signedUrls(FOTOS_BUCKET, keys);
      refs.forEach((r, i) => {
        r.fotoUrl = firmadas[i] || r.fotoUrl;
      });
    } catch (err) {
      this.logger.warn(
        `No se pudieron firmar las fotos del protocolo: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return items;
  }

  /**
   * Solo se firma en las LECTURAS (iniciar, getOne, list). En las mutaciones se
   * devuelve la key cruda: firmar es un round trip extra a Storage por cada
   * cambio del checklist, y el cliente ya tiene la URL firmada de la lectura
   * inicial (la conserva al mergear la respuesta).
   */
  private async firmarPortada<T extends { propiedad: { fotoUrl: string | null } }>(dto: T): Promise<T> {
    const [firmado] = await this.firmarPortadas([dto]);
    return firmado ?? dto;
  }
}

// --- mapeo a DTO -----------------------------------------------------------

function aAccionCalc(a: { semana: number; estado: string; fechaPrevista: Date | null }): AccionCalc {
  return {
    semana: a.semana,
    estado: a.estado as AccionCalc['estado'],
    fechaPrevista: fromDate(a.fechaPrevista),
  };
}

/** Días de exclusividad pactados, si la captación fue exclusiva. */
function diasDeExclusividad(exclusividad: Prisma.JsonValue): number | null {
  if (exclusividad == null || typeof exclusividad !== 'object' || Array.isArray(exclusividad)) return null;
  const dias = (exclusividad as Record<string, unknown>).dias;
  return typeof dias === 'number' ? dias : null;
}

function toResumen(row: ProtocoloRow): ProtocoloResumenDto {
  const fechaInicio = fromDate(row.fechaInicio)!;
  const acciones = row.acciones.map(aAccionCalc);
  const hoy = hoyArgentina();

  const proxima = row.acciones
    .filter((a) => a.estado !== 'realizada' && a.estado !== 'no_corresponde')
    .sort((a, b) => (fromDate(a.fechaPrevista) ?? '9999').localeCompare(fromDate(b.fechaPrevista) ?? '9999'))[0];

  return {
    id: row.id,
    version: row.updatedAt.toISOString(),
    estado: row.estado as ProtocoloResumenDto['estado'],
    fechaInicio,
    semanaActual: semanaActual(fechaInicio, hoy),
    diasPublicada: diasPublicada(fechaInicio, hoy),
    avance: avance(acciones),
    precioPublicado: row.precioPublicado == null ? null : decToNum(row.precioPublicado),
    moneda: row.moneda,
    vencimientoAutorizacion: fromDate(row.vencimientoAutorizacion),
    archivadoEn: fromDate(row.archivadoEn),
    motivoArchivo: (row.motivoArchivo as ProtocoloResumenDto['motivoArchivo']) || null,
    agente: row.agente,
    propiedad: {
      tasacionId: row.tasacion.id,
      direccion: row.tasacion.direccion,
      barrio: row.tasacion.barrio,
      ciudad: row.tasacion.ciudad,
      tipoPropiedad: row.tasacion.tipoPropiedad,
      tipoOperacion: row.tasacion.tipoOperacion,
      superficieTotal: row.tasacion.superficieTotal == null ? null : decToNum(row.tasacion.superficieTotal),
      dormitorios: row.tasacion.dormitorios,
      banos: row.tasacion.banos,
      valorRecomendado: row.tasacion.valorRecomendado == null ? null : decToNum(row.tasacion.valorRecomendado),
      fotoUrl: row.tasacion.fotos[0]?.url ?? null,
    },
    alertas: calcularAlertas(
      {
        estado: row.estado as 'activa' | 'archivada',
        fechaInicio,
        vencimientoAutorizacion: fromDate(row.vencimientoAutorizacion),
        actualizadoEn: row.updatedAt.toISOString().slice(0, 10),
        acciones,
        consultas: row.consultas,
        visitas: row.visitas,
      },
      hoy,
    ),
    proximaAccion: proxima?.titulo ?? null,
  };
}

function toDto(row: ProtocoloRow): ProtocoloDto {
  return {
    ...toResumen(row),
    propietarioNombre: row.propietarioNombre,
    propietarioTelefono: row.propietarioTelefono,
    propietarioEmail: row.propietarioEmail,
    embudo: calcularEmbudo({
      consultas: row.consultas,
      consultasCalificadas: row.consultasCalificadas,
      visitas: row.visitas,
      interesadosActivos: row.interesadosActivos,
      ofertas: row.ofertas,
    }),
    devolucionesMercado: row.devolucionesMercado,
    objeciones: row.objeciones,
    recomendacion: row.recomendacion,
    decisionPropietario: row.decisionPropietario,
    proximasAcciones: row.proximasAcciones,
    observacionArchivo: row.observacionArchivo,
    acciones: row.acciones.map((a) => ({
      id: a.id,
      semana: a.semana,
      orden: a.orden,
      clave: a.clave,
      titulo: a.titulo,
      estado: a.estado as ProtocoloDto['acciones'][number]['estado'],
      fechaPrevista: fromDate(a.fechaPrevista),
      fechaRealizada: fromDate(a.fechaRealizada),
      observaciones: a.observaciones,
      resultado: a.resultado,
      evidencia: a.evidencia,
    })),
  };
}
