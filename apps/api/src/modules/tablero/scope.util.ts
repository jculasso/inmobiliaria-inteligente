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

/** Roles que ven todo el tenant. */
const ROLES_TENANT: readonly Rol[] = ['direccion', 'admin_tenant', 'admin_plataforma'];

/** Modo de alcance según los roles (el más amplio gana). Puro y testeable. */
export function modoDeScope(roles: readonly Rol[]): ScopeMode {
  if (roles.some((r) => ROLES_TENANT.includes(r))) return 'tenant';
  if (roles.includes('team_leader')) return 'equipo';
  return 'propio';
}

/**
 * Resuelve el alcance concreto (lista de usuarioIds) para el contexto dado.
 * Para `equipo` consulta el líder + sus vendedores (lider_id = él).
 */
export async function resolverScope(
  ctx: TenantContext,
  tx: Prisma.TransactionClient,
  soloMio = false,
): Promise<Scope> {
  const mode = modoDeScope(ctx.roles);
  // "Ver solo lo mío": un CEO/Team Leader elige ver solo sus propias puntas/
  // tasaciones (seguimiento), sin cambiar su rol real. Un vendedor ya es 'propio'.
  if (soloMio || mode === 'propio') return { mode: 'propio', usuarioIds: [ctx.userId] };
  if (mode === 'tenant') return { mode, usuarioIds: null };

  const equipo = await tx.usuario.findMany({
    where: { OR: [{ id: ctx.userId }, { liderId: ctx.userId }] },
    select: { id: true },
  });
  return { mode, usuarioIds: equipo.map((u) => u.id) };
}
