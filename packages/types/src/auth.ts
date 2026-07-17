// Contrato de auth compartido back/front (respuesta de GET /me).
import { z } from 'zod';
import { RolSchema } from './rol';

export const AuthPrincipalSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  tenantId: z.string().uuid(),
  roles: z.array(RolSchema),
});

export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>;
