import type { AuthPrincipal } from '@vacker/types';
import { getMe } from './api';
import { createClient } from './supabase/server';

/**
 * Sesión + perfil resueltos server-side para las páginas de `/tablero/*`.
 * Devuelve `null` si no hay sesión o si `/me` falla (usuario sin fila en
 * `usuario`) — en ese caso `app/tablero/layout.tsx` ya muestra el error, así
 * que la página solo necesita no renderizar nada.
 */
export async function requireServerPrincipal(): Promise<{
  principal: AuthPrincipal;
  accessToken: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  try {
    const principal = await getMe(session.access_token);
    return { principal, accessToken: session.access_token };
  } catch {
    return null;
  }
}
