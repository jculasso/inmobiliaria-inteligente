import type { PlanTenant, Rol, TenantConfig } from '@vacker/types';

/** Usuario autenticado ya resuelto (identidad + tenant + roles). */
export interface AuthPrincipal {
  userId: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  tenantId: string;
  roles: Rol[];
  tenant: { nombre: string; plan: PlanTenant; config: TenantConfig };
}
