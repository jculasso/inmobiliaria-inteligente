import { AuthPrincipalSchema, type AuthPrincipal } from '@vacker/types';

export class MeError extends Error {}

/** Perfil del usuario autenticado (identidad + tenant + roles), resuelto por la API. */
export async function getMe(accessToken: string): Promise<AuthPrincipal> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new MeError('Falta NEXT_PUBLIC_API_URL en el entorno.');
  }

  const res = await fetch(`${apiUrl}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new MeError(`GET /me devolvió ${res.status}`);
  }

  const body: unknown = await res.json();
  const parsed = AuthPrincipalSchema.safeParse(body);
  if (!parsed.success) {
    throw new MeError('La respuesta de /me no tiene el formato esperado.');
  }
  return parsed.data;
}
