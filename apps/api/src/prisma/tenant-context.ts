import type { Rol } from '@vacker/types';

/** Contexto del request: identidad + tenant + roles del usuario autenticado. */
export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: Rol[];
}

/** Clave bajo la que se guarda el contexto en el CLS (nestjs-cls). */
export const TENANT_CTX_KEY = 'tenantContext';
