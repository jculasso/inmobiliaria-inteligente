import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

/** Cliente de Supabase para Client Components (login, logout). */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}

/** Access token de la sesión actual, para llamar a la API desde Client Components. */
export async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No hay sesión activa.');
  }
  return session.access_token;
}
