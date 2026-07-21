// Contratos del panel de administración de plataforma (tenants + usuarios +
// accesos). Solo lo usa el rol `admin_plataforma` (cross-tenant).
import { z } from 'zod';
import { RolSchema } from './rol';
import { PlanTenantSchema, TenantConfigSchema } from './tenant';

export { PlanTenantSchema };
export type { PlanTenant } from './tenant';

const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones.');

export const TenantDtoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  slug: z.string(),
  plan: PlanTenantSchema,
  estado: z.enum(['activo', 'suspendido']),
  config: TenantConfigSchema,
  createdAt: z.string(),
});
export type TenantDto = z.infer<typeof TenantDtoSchema>;

export const CreateTenantSchema = z.object({
  nombre: z.string().trim().min(1),
  slug: SlugSchema,
  plan: PlanTenantSchema.default('basico'),
  config: TenantConfigSchema.optional(),
});
export type CreateTenant = z.infer<typeof CreateTenantSchema>;

export const UpdateTenantSchema = z
  .object({
    nombre: z.string().trim().min(1),
    slug: SlugSchema,
    plan: PlanTenantSchema,
    estado: z.enum(['activo', 'suspendido']),
    config: TenantConfigSchema,
  })
  .partial();
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

export const UsuarioAdminDtoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  email: z.string().email(),
  estado: z.enum(['activo', 'inactivo']),
  roles: z.array(RolSchema),
  /** false para vendedores creados desde el Tablero sin cuenta de Auth todavía. */
  tieneAcceso: z.boolean(),
});
export type UsuarioAdminDto = z.infer<typeof UsuarioAdminDtoSchema>;

export const CreateUsuarioAdminSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
  roles: z.array(RolSchema).min(1),
});
export type CreateUsuarioAdmin = z.infer<typeof CreateUsuarioAdminSchema>;

export const UpdateUsuarioAdminSchema = z
  .object({
    nombre: z.string().min(1),
    estado: z.enum(['activo', 'inactivo']),
    roles: z.array(RolSchema).min(1),
  })
  .partial();
export type UpdateUsuarioAdmin = z.infer<typeof UpdateUsuarioAdminSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
});
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
