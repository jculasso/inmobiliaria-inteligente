import type { Prisma } from '@prisma/client';
import type { Rol } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';

/**
 * Scope por rol (CLAUDE.md §2.3, MODELO Parte C). Se aplica ANTES de calcular
 * KPIs y de listar operaciones, sobre el conjunto de puntas atribuidas a los
 * usuarios del alcance. RLS ya acota al tenant; esto acota dentro del tenant.
 */
export type ScopeMode = 'tenant' | 'equipo' | 'propio';

export interface Scope {
  mode: ScopeMode;
  /** usuarioIds cuyas puntas entran en el alcance; `null` = todo el tenant. */
  usuarioIds: string[] | null;
}

/**
 * Administradores de la plataforma y del tenant. No tienen puntas propias, así
 * que "lo mío" para ellos es el conjunto vacío: siempre ven todo y el check
 * "Ver todo" les resulta indistinto.
 */
const ROLES_ADMIN: readonly Rol[] = ['admin_tenant', 'admin_plataforma'];

/** Roles cuyo alcance MÁXIMO es todo el tenant. */
const ROLES_TENANT: readonly Rol[] = ['direccion', ...ROLES_ADMIN];

/** Alcance máximo que habilita el rol (el más amplio gana). Puro y testeable. */
export function modoDeScope(roles: readonly Rol[]): ScopeMode {
  if (roles.some((r) => ROLES_TENANT.includes(r))) return 'tenant';
  if (roles.includes('team_leader')) return 'equipo';
  return 'propio';
}

/** Expande un modo de alcance a la lista concreta de usuarioIds. */
async function usuariosDelModo(
  modo: ScopeMode,
  ctx: TenantContext,
  tx: Prisma.TransactionClient,
): Promise<Scope> {
  if (modo === 'tenant') return { mode: 'tenant', usuarioIds: null };
  if (modo === 'propio') return { mode: 'propio', usuarioIds: [ctx.userId] };
  const equipo = await tx.usuario.findMany({
    where: { OR: [{ id: ctx.userId }, { liderId: ctx.userId }] },
    select: { id: true },
  });
  return { mode: 'equipo', usuarioIds: equipo.map((u) => u.id) };
}

/**
 * QUÉ PUEDE TOCAR este usuario. Es la pregunta de permisos: se usa para decidir
 * si puede abrir, editar o borrar una ficha concreta (`assertEnScope`).
 *
 * Siempre devuelve el alcance MÁXIMO del rol y no depende de lo que la pantalla
 * esté mostrando en este momento. Un CEO que está mirando "solo lo mío" tiene
 * que poder abrir igual la operación de cualquiera: filtrar una lista y negar
 * un permiso son dos cosas distintas.
 */
export async function scopeDePermiso(
  ctx: TenantContext,
  tx: Prisma.TransactionClient,
): Promise<Scope> {
  return usuariosDelModo(modoDeScope(ctx.roles), ctx, tx);
}

/**
 * QUÉ SE MUESTRA en la pantalla. Es la pregunta de vista: se usa para filtrar
 * listados, KPIs y rankings.
 *
 * El default es LO PROPIO para todos los roles: se entra viendo el trabajo de
 * uno, y el check "Ver todo" (`verTodo`) expande al máximo que el rol habilita
 * —dirección a toda la inmobiliaria, team leader a su equipo—. Un vendedor ya
 * está en su máximo, así que el check no le cambia nada.
 *
 * Hasta el 28/07/2026 era al revés: se entraba viendo todo y el check ("Ver
 * solo lo mío") achicaba. Se invirtió por pedido del usuario.
 *
 * `verTodo` llega por query param, o sea que lo controla el cliente. Por eso
 * nunca agranda más allá de `modoDeScope`: es un filtro, no un permiso.
 */
export async function scopeDeVista(
  ctx: TenantContext,
  tx: Prisma.TransactionClient,
  verTodo = false,
): Promise<Scope> {
  // Los admins quedan afuera de la inversión a propósito: no tienen puntas
  // propias, así que arrancarlos en "lo mío" les mostraría una pantalla vacía.
  if (ctx.roles.some((r) => ROLES_ADMIN.includes(r))) return { mode: 'tenant', usuarioIds: null };
  if (!verTodo) return { mode: 'propio', usuarioIds: [ctx.userId] };
  return usuariosDelModo(modoDeScope(ctx.roles), ctx, tx);
}
