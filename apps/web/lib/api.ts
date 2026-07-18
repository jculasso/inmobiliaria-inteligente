import { cache } from 'react';
import { AuthPrincipalSchema, type AuthPrincipal } from '@vacker/types';

export class MeError extends Error {}

/**
 * Perfil del usuario autenticado (identidad + tenant + roles), resuelto por
 * la API. Envuelto en `React.cache()` porque tanto el layout de cada módulo
 * como sus páginas llaman esto por separado — sin memoizar por request, cada
 * navegación disparaba dos GET /me idénticos.
 */
export const getMe = cache(async (accessToken: string): Promise<AuthPrincipal> => {
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
});
