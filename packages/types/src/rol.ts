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
  'admin_tenant',
  'admin_plataforma',
]);

export type Rol = z.infer<typeof RolSchema>;
