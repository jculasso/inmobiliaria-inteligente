import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LIMITE_LISTA_CON_SONDA,
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_PRIORIDAD,
  type CambioReclamo,
  type Reclamo,
  type ReclamoDto,
  type ReclamoResumenDto,
} from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { nombresDeUsuarios, registrarEventos } from './historial';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];
type FilaReclamo = Prisma.AlqReclamoGetPayload<object>;

const ORDEN_PRIORIDAD = { urgente: 0, alta: 1, media: 2, baja: 3 } as const;

/**
 * Reclamos de inquilinos y propietarios (entrega 15, como Gexion): asunto,
 * tipo, prioridad, estado, a quién está asignado, y un historial de notas con
 * quién escribió cada una. Cada cambio deja su nota.
 */
@Injectable()
export class ReclamosService {
  constructor(private readonly db: TenantPrismaService) {}

  async listar(q: {
    estado: 'abiertos' | 'todos';
    contratoId?: string;
    personaId?: string;
  }): Promise<ReclamoResumenDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqReclamo.findMany({
        where: {
          ...(q.estado === 'abiertos' ? { estado: { in: ['abierto', 'en_curso'] } } : {}),
          ...(q.contratoId ? { contratoId: q.contratoId } : {}),
          ...(q.personaId ? { personaId: q.personaId } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: LIMITE_LISTA_CON_SONDA,
      });
      const resumenes = await this.resumenes(tx, filas);
      return resumenes.sort(
        (a, b) =>
          ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] ||
          (a.actualizado < b.actualizado ? 1 : -1),
      );
    });
  }

  async obtener(id: string): Promise<ReclamoDto> {
    return this.db.withTenant((tx) => this.obtenerEn(tx, id));
  }

  async crear(ctx: TenantContext, dto: Reclamo): Promise<ReclamoDto> {
    return this.db.withTenant(async (tx) => {
      await referenciasDeLaInmobiliaria(tx, {
        contratoId: dto.contratoId,
        personaId: dto.personaId,
        asignadoAId: dto.asignadoAId,
      });
      // Si viene el contrato y no la persona, el reclamo es de su inquilino.
      let personaId = dto.personaId;
      if (!personaId && dto.contratoId) {
        const inq = await tx.alqContratoParte.findFirst({
          where: { contratoId: dto.contratoId, papel: 'inquilino' },
          orderBy: { personaId: 'asc' },
          select: { personaId: true },
        });
        personaId = inq?.personaId ?? null;
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId} || ':alq_reclamo'))`;
      const ultimo = await tx.alqReclamo.aggregate({ _max: { numero: true } });
      const numero = (ultimo._max.numero ?? 0) + 1;
      const r = await tx.alqReclamo.create({
        data: { ...dto, personaId, numero, tenantId: ctx.tenantId, creadoPorId: ctx.userId },
      });
      await this.nota(
        tx,
        ctx,
        r.id,
        `Abrió el reclamo (${NOMBRE_PRIORIDAD[dto.prioridad].toLowerCase()} prioridad).`,
      );
      await registrarEventos(tx, ctx, {
        entidad: 'reclamo',
        entidadId: r.id,
        contratoId: dto.contratoId,
        personaId,
        accion: 'alta',
        resumen: `Reclamo ${numero}: ${dto.asunto}`,
      });
      return this.obtenerEn(tx, r.id);
    });
  }

  /** Cambiar estado, prioridad o asignado, y anotar lo hecho: todo queda en el historial. */
  async cambiar(ctx: TenantContext, id: string, cambio: CambioReclamo): Promise<ReclamoDto> {
    return this.db.withTenant(async (tx) => {
      const r = await tx.alqReclamo.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('El reclamo no existe.');
      const partes: string[] = [];
      const data: Prisma.AlqReclamoUpdateInput = {};
      if (cambio.estado && cambio.estado !== r.estado) {
        partes.push(
          `Estado: ${NOMBRE_ESTADO_RECLAMO[r.estado as keyof typeof NOMBRE_ESTADO_RECLAMO]} → ${NOMBRE_ESTADO_RECLAMO[cambio.estado]}.`,
        );
        data.estado = cambio.estado;
        data.cerradoEn =
          cambio.estado === 'cerrado' || cambio.estado === 'resuelto' ? new Date() : null;
      }
      if (cambio.prioridad && cambio.prioridad !== r.prioridad) {
        partes.push(`Prioridad: ${NOMBRE_PRIORIDAD[cambio.prioridad].toLowerCase()}.`);
        data.prioridad = cambio.prioridad;
      }
      if (cambio.asignadoAId !== undefined && cambio.asignadoAId !== r.asignadoAId) {
        await referenciasDeLaInmobiliaria(tx, { asignadoAId: cambio.asignadoAId });
        const n = cambio.asignadoAId
          ? (await nombresDeUsuarios(tx, [cambio.asignadoAId])).get(cambio.asignadoAId)
          : null;
        partes.push(cambio.asignadoAId ? `Asignado a ${n ?? 'otro usuario'}.` : 'Sin asignar.');
        data.asignadoAId = cambio.asignadoAId;
      }
      if (cambio.nota) partes.push(cambio.nota);
      if (partes.length === 0) return this.obtenerEn(tx, id);
      if (Object.keys(data).length) await tx.alqReclamo.update({ where: { id }, data });
      else await tx.alqReclamo.update({ where: { id }, data: { updatedAt: new Date() } });
      await this.nota(tx, ctx, id, partes.join(' '));
      if (data.estado) {
        await registrarEventos(tx, ctx, {
          entidad: 'reclamo',
          entidadId: id,
          contratoId: r.contratoId,
          personaId: r.personaId,
          accion: 'estado',
          resumen: `Reclamo ${r.numero}: ${NOMBRE_ESTADO_RECLAMO[cambio.estado!].toLowerCase()}`,
        });
      }
      return this.obtenerEn(tx, id);
    });
  }

  /** Los usuarios activos de la inmobiliaria, para asignar un reclamo. */
  async usuarios(): Promise<{ id: string; nombre: string }[]> {
    return this.db.withTenant((tx) =>
      tx.usuario.findMany({
        where: { estado: 'activo' },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    );
  }

  private async nota(tx: Tx, ctx: TenantContext, reclamoId: string, texto: string) {
    const u = await tx.usuario.findUnique({ where: { id: ctx.userId }, select: { nombre: true } });
    await tx.alqReclamoNota.create({
      data: {
        tenantId: ctx.tenantId,
        reclamoId,
        usuarioId: ctx.userId,
        usuarioNombre: u?.nombre ?? null,
        texto,
      },
    });
  }

  private async obtenerEn(tx: Tx, id: string): Promise<ReclamoDto> {
    const r = await tx.alqReclamo.findUnique({
      where: { id },
      include: { notas: { orderBy: { en: 'desc' } } },
    });
    if (!r) throw new NotFoundException('El reclamo no existe.');
    const [resumen] = await this.resumenes(tx, [r]);
    const abiertoPor = r.creadoPorId
      ? ((await nombresDeUsuarios(tx, [r.creadoPorId])).get(r.creadoPorId) ?? null)
      : null;
    return {
      ...resumen!,
      descripcion: r.descripcion,
      asignadoAId: r.asignadoAId,
      abiertoPor,
      notas: r.notas.map((n) => ({
        id: n.id,
        en: n.en.toISOString(),
        usuario: n.usuarioNombre,
        texto: n.texto,
      })),
    };
  }

  /** Los nombres de contratos, personas y asignados: tres consultas para toda la lista. */
  private async resumenes(tx: Tx, filas: FilaReclamo[]): Promise<ReclamoResumenDto[]> {
    const ids = (f: (r: FilaReclamo) => string | null) => [
      ...new Set(filas.map(f).filter((x): x is string => !!x)),
    ];
    const [contratos, personas, usuarios] = await Promise.all([
      ids((r) => r.contratoId).length
        ? tx.alqContrato.findMany({
            where: { id: { in: ids((r) => r.contratoId) } },
            select: {
              id: true,
              codigo: true,
              propiedad: { select: { direccion: true, unidad: true } },
            },
          })
        : [],
      ids((r) => r.personaId).length
        ? tx.alqPersona.findMany({
            where: { id: { in: ids((r) => r.personaId) } },
            select: { id: true, nombre: true },
          })
        : [],
      nombresDeUsuarios(
        tx,
        filas.map((r) => r.asignadoAId),
      ),
    ]);
    const c = new Map(contratos.map((x) => [x.id, x]));
    const p = new Map(personas.map((x) => [x.id, x]));
    return filas.map((r) => {
      const k = r.contratoId ? c.get(r.contratoId) : undefined;
      return {
        id: r.id,
        numero: r.numero,
        asunto: r.asunto,
        tipo: r.tipo as ReclamoResumenDto['tipo'],
        prioridad: r.prioridad as ReclamoResumenDto['prioridad'],
        estado: r.estado as ReclamoResumenDto['estado'],
        contrato: k
          ? {
              id: k.id,
              codigo: k.codigo,
              propiedad: [k.propiedad.direccion, k.propiedad.unidad].filter(Boolean).join(' '),
            }
          : null,
        persona: r.personaId ? (p.get(r.personaId) ?? null) : null,
        asignadoA: r.asignadoAId ? (usuarios.get(r.asignadoAId) ?? null) : null,
        abierto: r.createdAt.toISOString(),
        actualizado: r.updatedAt.toISOString(),
      };
    });
  }
}

/**
 * Los ids que llegan del pedido tienen que ser de esta inmobiliaria. El
 * reclamo no tiene claves foráneas, así que la base no lo frenaría: se buscan
 * acá, con RLS, y lo que no aparece no existe (auditoría del 6/10/2026).
 */
async function referenciasDeLaInmobiliaria(
  tx: Tx,
  ids: { contratoId?: string | null; personaId?: string | null; asignadoAId?: string | null },
): Promise<void> {
  const [contrato, persona, usuario] = await Promise.all([
    ids.contratoId ? tx.alqContrato.count({ where: { id: ids.contratoId } }) : 1,
    ids.personaId ? tx.alqPersona.count({ where: { id: ids.personaId } }) : 1,
    ids.asignadoAId ? tx.usuario.count({ where: { id: ids.asignadoAId } }) : 1,
  ]);
  if (!contrato) throw new NotFoundException('El contrato no existe.');
  if (!persona) throw new NotFoundException('La persona no existe.');
  if (!usuario) throw new NotFoundException('El usuario asignado no existe.');
}
