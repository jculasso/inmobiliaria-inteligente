// Contrato de auth compartido back/front (respuesta de GET /me).
import { z } from 'zod';
import { RolSchema } from './rol';
import { PlanTenantSchema, TenantConfigSchema } from './tenant';

export const AuthPrincipalSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  nombre: z.string(),
  fotoUrl: z.string().nullable(),
  tenantId: z.string().uuid(),
  roles: z.array(RolSchema),
  /** Branding + plan del tenant — resuelto en el mismo query que roles, sin round trip extra. */
  tenant: z.object({
    nombre: z.string(),
    plan: PlanTenantSchema,
    config: TenantConfigSchema,
  }),
});

export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>;
