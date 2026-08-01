// Contratos del panel de administración de plataforma (tenants + usuarios +
// accesos). Solo lo usa el rol `admin_plataforma` (cross-tenant).
import { z } from 'zod';
import { RolSchema } from './rol';
import { ModulosTenantSchema, PlanTenantSchema, TenantConfigSchema } from './tenant';

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
  modulos: ModulosTenantSchema,
  estado: z.enum(['activo', 'suspendido']),
  config: TenantConfigSchema,
  createdAt: z.string(),
});
export type TenantDto = z.infer<typeof TenantDtoSchema>;

export const CreateTenantSchema = z.object({
  nombre: z.string().trim().min(1),
  slug: SlugSchema,
  plan: PlanTenantSchema.default('basico'),
  modulos: ModulosTenantSchema.optional(),
  config: TenantConfigSchema.optional(),
});
export type CreateTenant = z.infer<typeof CreateTenantSchema>;

export const UpdateTenantSchema = z
  .object({
    nombre: z.string().trim().min(1),
    slug: SlugSchema,
    plan: PlanTenantSchema,
    modulos: ModulosTenantSchema,
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
  fotoUrl: z.string().nullable(),
  telefono: z.string().nullable(),
  /** true = todavía usa la clave temporal que le dio el implementador. */
  debeCambiarPassword: z.boolean(),
  /**
   * Recibe el reporte semanal del Protocolo por mail.
   *
   * NO se deriva del rol. En Vacker `direccion` son cuatro personas —los dos
   * dueños y los dos implementadores— y mandarlo "a los direccion" se lo manda
   * también a quienes no lo pidieron. Quién recibe un mail es una decisión de
   * negocio; el rol es un permiso.
   */
  recibeReporteSemanal: z.boolean(),
});
export type UsuarioAdminDto = z.infer<typeof UsuarioAdminDtoSchema>;

export const CreateUsuarioAdminSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
  roles: z.array(RolSchema).min(1),
  telefono: z.string().nullish(),
});
export type CreateUsuarioAdmin = z.infer<typeof CreateUsuarioAdminSchema>;

/** Cambio de la propia contraseña (POST /me/password). */
export const CambiarPasswordSchema = z.object({
  /** No se exige en el cambio obligatorio: la sesión recién creada ya lo prueba. */
  passwordActual: z.string().optional(),
  passwordNueva: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});
export type CambiarPassword = z.infer<typeof CambiarPasswordSchema>;

export const UpdateUsuarioAdminSchema = z
  .object({
    /** Cambia el email de acceso (también en Supabase Auth, no solo acá). */
    email: z.string().trim().email(),
    nombre: z.string().min(1),
    estado: z.enum(['activo', 'inactivo']),
    roles: z.array(RolSchema).min(1),
    telefono: z.string().nullish(),
    recibeReporteSemanal: z.boolean(),
  })
  .partial();
export type UpdateUsuarioAdmin = z.infer<typeof UpdateUsuarioAdminSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
});
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;

/**
 * Quién puede descargar todos los datos de la inmobiliaria.
 *
 * Solo la dirección y el admin del inquilino: el archivo trae la cartera
 * entera, las comisiones de cada vendedor y los datos de los propietarios.
 * No es información de trabajo diario.
 *
 * UNA sola definición, usada por el `@Roles` de la API y por el gate de la
 * web — la lección de `ROLES_PUBLICACION`, donde las dos listas se separaron.
 */
export const ROLES_EXPORTACION = ['direccion', 'admin_tenant'] as const;
