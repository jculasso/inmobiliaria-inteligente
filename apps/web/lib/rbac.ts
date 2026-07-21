import type { Rol } from '@vacker/types';

export type AlcanceModulo = 'propio' | 'equipo' | 'total' | 'ver';

const ETIQUETA: Record<AlcanceModulo, string> = {
  propio: 'Propio',
  equipo: 'Equipo',
  total: 'Total',
  ver: 'Ver',
};

/**
 * Alcance de Tablero/Tasador/To Do List según la matriz de acceso por rol
 * (docs/Arquitectura_Inmobiliaria_Inteligente.md §9). `admin_plataforma` es un
 * rol de plano-plataforma, no de tenant: no tiene alcance definido acá.
 */
const PRIORIDAD: { rol: Rol; alcance: AlcanceModulo }[] = [
  { rol: 'direccion', alcance: 'total' },
  { rol: 'team_leader', alcance: 'equipo' },
  { rol: 'vendedor', alcance: 'propio' },
  { rol: 'admin_tenant', alcance: 'ver' },
];

/** Alcance del rol más privilegiado del usuario, o `null` si ninguno aplica (p. ej. admin_plataforma solo). */
export function alcanceDeModulo(roles: Rol[]): AlcanceModulo | null {
  const match = PRIORIDAD.find((p) => roles.includes(p.rol));
  return match?.alcance ?? null;
}

export function etiquetaDeAlcance(alcance: AlcanceModulo): string {
  return ETIQUETA[alcance];
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  vendedor: 'Vendedor',
  team_leader: 'Team Leader',
  direccion: 'Dirección',
  admin_tenant: 'Admin tenant',
  admin_plataforma: 'Admin plataforma',
};

/** Rol más privilegiado del usuario dentro del tenant (mismo orden que `alcanceDeModulo`). */
export function rolPrincipal(roles: Rol[]): Rol | null {
  const match = PRIORIDAD.find((p) => roles.includes(p.rol));
  return match?.rol ?? null;
}

// Gates de UI para el Tablero: reflejan literalmente los @Roles() de
// apps/api/src/modules/tablero/{operaciones,vendedores}.controller.ts, para no
// ofrecer en el front acciones que la API va a rechazar con 403.

/** GET /tablero/vendedores: un `vendedor` puro no tiene acceso, ni de lectura. */
export function puedeVerVendedores(roles: Rol[]): boolean {
  return roles.some((r) => r === 'team_leader' || r === 'direccion' || r === 'admin_tenant');
}

/** POST/PATCH/DELETE /tablero/vendedores y PUT .../objetivo. */
export function puedeGestionarVendedores(roles: Rol[]): boolean {
  return roles.some((r) => r === 'direccion' || r === 'admin_tenant');
}

/** DELETE /tablero/operaciones/:id. */
export function puedeBorrarOperaciones(roles: Rol[]): boolean {
  return roles.some((r) => r === 'team_leader' || r === 'direccion' || r === 'admin_tenant');
}

/** DELETE /tasador/tasaciones/:id. */
export function puedeBorrarTasaciones(roles: Rol[]): boolean {
  return roles.some((r) => r === 'team_leader' || r === 'direccion' || r === 'admin_tenant');
}
