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
  'admin_tenant',
  'admin_plataforma',
]);

export type Rol = z.infer<typeof RolSchema>;
