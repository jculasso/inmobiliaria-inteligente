// @vacker/types — schemas y tipos Zod compartidos back/front.
//
// Placeholder de Fundaciones (Paso 1). Los schemas de negocio del núcleo
// (tenant, usuario, roles) y del Tablero se agregan en los Pasos 2 y 3.
//
// Convención: cada schema Zod exporta también su tipo inferido, p. ej.
//   export const FooSchema = z.object({ ... });
//   export type Foo = z.infer<typeof FooSchema>;
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

// Contratos del módulo Tablero Comercial (Paso 3).
export * from './tablero';
