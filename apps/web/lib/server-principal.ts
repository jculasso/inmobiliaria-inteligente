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

/**
 * La sesión al toque y el perfil como promesa, para pedirlo EN PARALELO con los
 * datos de la página. Con `requireServerPrincipal` cada página esperaba `/me`
 * y recién después pedía sus datos: una ida y vuelta de más en cada
 * navegación (revisión de performance del 6/10/2026).
 *
 *   const s = await sesionServidor();
 *   if (!s) return null;
 *   const [principal, datos] = await Promise.all([s.principal, getDatos(s.accessToken)]);
 *   if (!principal) return null;
 *
 * Solo para páginas que no deciden QUÉ pedir según el rol: si la página tiene
 * que mirar el rol antes (para no pedir algo que daría 403), sigue con
 * `requireServerPrincipal`.
 */
export async function sesionServidor(): Promise<{
  accessToken: string;
  principal: Promise<AuthPrincipal | null>;
} | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    accessToken: session.access_token,
    principal: getMe(session.access_token).catch(() => null),
  };
}
