import { z } from 'zod';

/**
 * Roles del sistema (RBAC sensible al tenant). Ver CLAUDE.md §2.3.
 * Se define acá temprano porque es un contrato compartido estable;
 * su uso real (guards, claims) llega en el Paso 2.
 */
export const RolSchema = z.enum([
  'vendedor',
  'team_leader',
  'direccion',
  /**
   * Publica propiedades en Tokko y, más adelante, en la web de la inmobiliaria.
   * Es un rol FUNCIONAL, no de jerarquía: en Vacker lo va a tener la persona
   * administrativa que hoy carga las propiedades a mano en Tokko. No implica
   * ver ni tocar nada del Tablero.
   */
  'publicador',
  /**
   * Administra los alquileres: contratos, indexaciones, cobros y liquidaciones
   * (módulo Alquileres). Rol FUNCIONAL, como `publicador`: lo tiene la persona
   * que hoy opera Gexion en Vacker. No ve nada del Tablero Comercial — ni
   * comisiones, ni objetivos, ni la sección de alquileres firmados, que es de
   * conducción (`ROLES_ALQUILERES`).
   */
  'administracion',
  'admin_tenant',
  'admin_plataforma',
]);

export type Rol = z.infer<typeof RolSchema>;

/**
 * Quién ve los alquileres del Tablero Comercial.
 *
 * Los alquileres se cargan SIN puntas: no son de ningún vendedor, son de la
 * inmobiliaria. Por eso no los rige el tilde «Ver todo», que decide de QUIÉN
 * son las ventas que uno mira; acá no hay de quién. O se ven los de la
 * inmobiliaria entera, o no se ven.
 *
 * Decidido con Vacker el 25/09/2026: los ve dirección y el administrador, con o
 * sin «Ver todo». Un team leader o un vendedor no ven la sección — en vez de
 * verla llena de ceros, que es lo que pasaba antes y parecía un error.
 *
 * Es una lista de los que SÍ, a propósito: un rol nuevo —como `publicador`—
 * queda afuera hasta que alguien decida lo contrario.
 *
 * Una sola regla para los tres lugares que la necesitan: el guard del endpoint,
 * la tarjeta de arriba del tablero y la sección. Si se separaran, la tarjeta
 * podría decir 0 mientras la sección dice 35.
 */
export const ROLES_ALQUILERES = ['direccion', 'admin_tenant'] as const satisfies readonly Rol[];

export function puedeVerAlquileres(roles: readonly Rol[]): boolean {
  return roles.some((r) => (ROLES_ALQUILERES as readonly Rol[]).includes(r));
}

/**
 * Quién entra al módulo Alquileres (la administración de contratos).
 *
 * NO confundir con `ROLES_ALQUILERES`, de arriba: esa es la sección de
 * alquileres firmados del Tablero Comercial —un número de conducción— y no
 * incluye a `administracion`. Esta es la operación diaria de los contratos.
 *
 * En este módulo ver y poder coinciden: los contratos no tienen puntas, son de
 * la inmobiliaria. Quien entra ve la cartera entera; quien no, nada. Ver
 * docs/specs/alquileres-fase-1.md §3.
 *
 * La usan el `@Roles` de cada endpoint del módulo, la Home y el layout de la
 * web: una sola lista, para que no se separen (la lección de
 * `ROLES_PUBLICACION`).
 */
export const ROLES_ADMINISTRACION_ALQUILERES = [
  'administracion',
  'direccion',
  'admin_tenant',
] as const satisfies readonly Rol[];

export function puedeAdministrarAlquileres(roles: readonly Rol[]): boolean {
  return roles.some((r) => (ROLES_ADMINISTRACION_ALQUILERES as readonly Rol[]).includes(r));
}
