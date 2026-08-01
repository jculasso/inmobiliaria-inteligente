import {
  ROLES_EXPORTACION,
  ROLES_PUBLICACION,
  ROLES_REPORTE_PROTOCOLO,
  type Rol,
} from '@vacker/types';

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
  publicador: 'Publicador',
  admin_tenant: 'Admin tenant',
  admin_plataforma: 'Admin plataforma',
};

/**
 * Ve y usa el módulo de Publicación.
 *
 * Usa la MISMA constante que los `@Roles` de la API (`ROLES_PUBLICACION` en
 * @vacker/types). Estaba duplicada y las dos listas se separaron: el front
 * dejaba entrar a `admin_plataforma` y la API respondía 403, que el borde de
 * error mostraba como "no pudimos conectar con el servidor".
 */
export function puedeUsarPublicacion(roles: Rol[]): boolean {
  return roles.some((r) => (ROLES_PUBLICACION as readonly string[]).includes(r));
}

/**
 * Ve el reporte semanal del Protocolo (GET /protocolo/reporte-semanal).
 *
 * Usa la MISMA constante que el `@Roles` de la API. Es información de
 * conducción: el vendedor y el team leader ven sus propias alertas en el
 * dashboard del módulo, pero el reporte completo de la inmobiliaria es otra
 * cosa.
 */
export function puedeVerReporteProtocolo(roles: Rol[]): boolean {
  return roles.some((r) => (ROLES_REPORTE_PROTOCOLO as readonly string[]).includes(r));
}

/**
 * Descarga todos los datos de la inmobiliaria.
 *
 * Misma constante que el `@Roles` de la API. El archivo trae la cartera
 * entera, las comisiones de cada vendedor y los datos de los propietarios: no
 * es información de trabajo diario.
 */
export function puedeExportarDatos(roles: Rol[]): boolean {
  return roles.some((r) => (ROLES_EXPORTACION as readonly string[]).includes(r));
}

/** Rol más privilegiado del usuario dentro del tenant (mismo orden que `alcanceDeModulo`). */
export function rolPrincipal(roles: Rol[]): Rol | null {
  const match = PRIORIDAD.find((p) => roles.includes(p.rol));
  return match?.rol ?? null;
}

// Gates de UI para el Tablero: reflejan literalmente los @Roles() de
// apps/api/src/modules/tablero/{operaciones,vendedores}.controller.ts, para no
// ofrecer en el front acciones que la API va a rechazar con 403.

/**
 * GET /tablero/vendedores. La pantalla muestra el equipo con sus objetivos:
 * es información de conducción, no de trabajo diario.
 *
 * El team leader la tenía y se le sacó el 29/07/2026 por pedido del usuario.
 * Ahora coincide exactamente con `puedeGestionarVendedores` — ver y gestionar
 * quedaron en las mismas manos, así que la pantalla no tiene modo lectura.
 */
export function puedeVerVendedores(roles: Rol[]): boolean {
  return roles.some((r) => r === 'direccion' || r === 'admin_tenant');
}

/** POST/PATCH/DELETE /tablero/vendedores y PUT .../objetivo. */
export function puedeGestionarVendedores(roles: Rol[]): boolean {
  return roles.some((r) => r === 'direccion' || r === 'admin_tenant');
}

/**
 * Muestra el check "Ver todo". Solo aparece para quien el check le CAMBIA algo:
 * dirección (pasa a ver toda la inmobiliaria) y team leader (pasa a ver su
 * equipo).
 *
 * Queda oculto en los dos extremos, por la misma razón —no haría nada—:
 * el vendedor ya está en su alcance máximo, y el admin ve todo siempre.
 *
 * Espejo de `resolverScope` en la API (scope.util.ts).
 */
export function puedeVerTodo(roles: Rol[]): boolean {
  const esAdmin = roles.some((r) => r === 'admin_tenant' || r === 'admin_plataforma');
  if (esAdmin) return false;
  return roles.some((r) => r === 'direccion' || r === 'team_leader');
}

/**
 * Alta, edición y borrado de operaciones (POST/PATCH/DELETE
 * /tablero/operaciones). Solo dirección y el admin del tenant: la carga la
 * centraliza la inmobiliaria para que los números del tablero tengan un único
 * origen. El vendedor y el team leader SIGUEN VIENDO lo suyo —lo necesitan
 * para sus KPIs y su ranking—, solo que en modo lectura.
 *
 * Espejo exacto de `PUEDEN_ESCRIBIR` en operaciones.controller.ts: esto oculta
 * los botones, pero quien manda es la API.
 */
export function puedeEscribirOperaciones(roles: Rol[]): boolean {
  return roles.some((r) => r === 'direccion' || r === 'admin_tenant');
}

/** DELETE /tasador/tasaciones/:id. */
export function puedeBorrarTasaciones(roles: Rol[]): boolean {
  return roles.some((r) => r === 'team_leader' || r === 'direccion' || r === 'admin_tenant');
}

/** POST /protocolo/:id/desarchivar — reabrir una propiedad archivada por error. */
export function puedeReabrirProtocolo(roles: Rol[]): boolean {
  return roles.some((r) => r === 'team_leader' || r === 'direccion' || r === 'admin_tenant');
}
