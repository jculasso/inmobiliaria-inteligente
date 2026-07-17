import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

/** Cliente de Supabase para Client Components (login, logout). */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}
