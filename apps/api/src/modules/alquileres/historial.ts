import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccionEvento, EntidadEvento, EventoDto } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

type Tx = Parameters<Parameters<TenantPrismaService['withTenant']>[0]>[0];

/** «$ 650.000,00» / «U$S 1.200,00», como en el recibo. */
export const plata = (n: number, moneda: string) =>
  `${moneda === 'USD' ? 'U$S' : '$'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** «2026-10-06» → «06/10/2026». */
export const dia = (iso: string) => iso.split('-').reverse().join('/');

export interface EventoNuevo {
  entidad: EntidadEvento;
  entidadId: string;
  accion: AccionEvento;
  /** Lo que se lee en el historial: «Recibo 000123 por $ 650.000». */
  resumen: string;
  contratoId?: string | null;
  personaId?: string | null;
  detalle?: Prisma.InputJsonValue;
}

/**
 * Deja asentado quién hizo qué (pedido de Javier del 6/10/2026: «quién es el
 * operador que registra la transacción»). Se llama DENTRO de la transacción
 * del cambio: si el cambio se deshace, el evento también.
 *
 * Dos consultas, siempre las mismas: el nombre del operador y un solo insert
 * para todos los eventos, aunque sean cien (generar el mes escribe uno por
 * contrato).
 */
export async function registrarEventos(tx: Tx, ctx: TenantContext, eventos: EventoNuevo | EventoNuevo[]): Promise<void> {
  const lista = Array.isArray(eventos) ? eventos : [eventos];
  if (lista.length === 0) return;
  const usuario = await tx.usuario.findUnique({ where: { id: ctx.userId }, select: { nombre: true } });
  await tx.alqEvento.createMany({
    data: lista.map((e) => ({
      tenantId: ctx.tenantId,
      usuarioId: ctx.userId,
      usuarioNombre: usuario?.nombre ?? null,
      entidad: e.entidad,
      entidadId: e.entidadId,
      accion: e.accion,
      resumen: e.resumen,
      contratoId: e.contratoId ?? null,
      personaId: e.personaId ?? null,
      detalle: e.detalle,
    })),
  });
}

/**
 * Los nombres de los usuarios que registraron o anularon algo, en una sola
 * consulta. Los `*PorId` no tienen clave foránea (son auditoría), así que el
 * nombre se busca aparte; un id que ya no existe queda sin nombre.
 */
export async function nombresDeUsuarios(tx: Tx, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (unicos.length === 0) return new Map();
  const filas = await tx.usuario.findMany({ where: { id: { in: unicos } }, select: { id: true, nombre: true } });
  return new Map(filas.map((u) => [u.id, u.nombre]));
}

/** Tope del historial que se muestra de una vez: el de un contrato de años entra holgado. */
const TOPE_HISTORIAL = 300;

/** Lee el historial de un contrato o de una persona, lo más nuevo primero. */
@Injectable()
export class HistorialService {
  constructor(private readonly db: TenantPrismaService) {}

  async delContrato(contratoId: string): Promise<EventoDto[]> {
    return this.leer({ contratoId });
  }

  async dePersona(personaId: string): Promise<EventoDto[]> {
    return this.leer({ personaId });
  }

  private async leer(where: Prisma.AlqEventoWhereInput): Promise<EventoDto[]> {
    return this.db.withTenant(async (tx) => {
      const filas = await tx.alqEvento.findMany({ where, orderBy: { en: 'desc' }, take: TOPE_HISTORIAL });
      return filas.map((e) => ({
        id: e.id,
        en: e.en.toISOString(),
        usuario: e.usuarioNombre,
        entidad: e.entidad as EntidadEvento,
        accion: e.accion as AccionEvento,
        resumen: e.resumen,
      }));
    });
  }
}
