import type { Rol } from '@vacker/types';

/** Usuario autenticado ya resuelto (identidad + tenant + roles). */
export interface AuthPrincipal {
  userId: string;
  email: string;
  tenantId: string;
  roles: Rol[];
}
