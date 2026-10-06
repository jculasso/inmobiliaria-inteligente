/**
 * Qué decirle a la persona cuando el ingreso falla.
 *
 * El login de la Home y el de /admin decían «Email o clave incorrectos.» ante
 * CUALQUIER error, también sin conexión: en la calle, con el celular sin
 * señal, la persona volvía a escribir una clave que estaba bien, y después de
 * varios intentos la pedía de nuevo al administrador (revisión del 6/10/2026).
 *
 * Supabase Auth, cuando no llega al servidor, no tira: devuelve un error
 * `AuthRetryableFetchError` con `status` 0 (o sin status). Eso, o el navegador
 * diciendo que está desconectado, es «no hay conexión»; lo demás, credenciales.
 */
export const MENSAJE_SIN_CONEXION = 'No hay conexión. Revisá internet y probá de nuevo.';
export const MENSAJE_CREDENCIALES = 'Email o clave incorrectos.';

export function esFallaDeRed(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; status?: unknown };
  if (e.name === 'AuthRetryableFetchError') return true;
  // Un `fetch` que ni salió (sin red, DNS, CORS) es un TypeError.
  if (error instanceof TypeError) return true;
  return e.status === 0;
}

/** El mensaje para un error de `signInWithPassword` (devuelto o lanzado). */
export function mensajeDeIngreso(error: unknown): string {
  return esFallaDeRed(error) ? MENSAJE_SIN_CONEXION : MENSAJE_CREDENCIALES;
}
