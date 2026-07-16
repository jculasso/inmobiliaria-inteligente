/** Identidad devuelta por el proveedor de auth tras verificar un token. */
export interface AuthIdentity {
  userId: string;
  email: string;
}

/**
 * Abstracción del proveedor de identidad. Hoy la implementa Supabase; mañana
 * podría ser Keycloak/Auth0 sin tocar los módulos de negocio (CLAUDE.md §3).
 * Solo resuelve identidad; el tenant y los roles se derivan de nuestra base.
 */
export interface AuthProvider {
  verifyToken(token: string): Promise<AuthIdentity>;
}

/** Token de inyección para el AuthProvider. */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
