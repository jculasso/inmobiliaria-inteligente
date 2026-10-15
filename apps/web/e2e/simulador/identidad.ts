import { createHmac } from 'node:crypto';

/**
 * Quién está logueado en las pruebas con sesión, y cómo se arma su sesión.
 *
 * Los dos lados lo usan: el simulador, para contestar `/auth/v1/user` y `/me`,
 * y las pruebas, para dejar la cookie puesta antes de abrir la página. Así la
 * app pasa el middleware sin tocar Supabase de verdad.
 */

/** Los puertos del simulador. Tienen que coincidir con `e2e/entorno-de-prueba.env`. */
export const PUERTO_API = 3291;
export const PUERTO_AUTH = 3292;
export const URL_API = `http://localhost:${PUERTO_API}`;

export const USUARIO = {
  id: '0e2e0000-0000-4000-8000-000000000001',
  email: 'prueba@inmobiliaria-de-prueba.test',
  nombre: 'Persona de Prueba',
} as const;

export const TENANT_ID = '0e2e0000-0000-4000-8000-0000000000aa';

/** Un día: alcanza para cualquier corrida y evita que el cliente intente refrescar. */
const VIGENCIA_S = 24 * 60 * 60;

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/**
 * Un JWT HS256. Con algoritmo simétrico, `getClaims()` no busca claves:
 * pregunta a `/auth/v1/user`, que contesta el simulador. La firma no la
 * verifica nadie: el secreto es de mentira, como todo lo demás.
 *
 * `escenario` separa los datos de cada prueba: el simulador guarda lo que una
 * prueba cambia (cobrar una seña, cerrar una reserva) bajo ese nombre, así las
 * pruebas que corren en paralelo no se pisan. Viaja en el token porque es lo
 * único que llega igual desde el navegador y desde el servidor de Next.
 */
export function tokenDePrueba(escenario = 'base'): string {
  const ahora = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: USUARIO.id,
      email: USUARIO.email,
      role: 'authenticated',
      aud: 'authenticated',
      iat: ahora,
      exp: ahora + VIGENCIA_S,
      escenario,
    }),
  );
  const firma = createHmac('sha256', 'simulador-de-mentira')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${firma}`;
}

/** El usuario tal como lo devuelve Supabase en `/auth/v1/user`. */
export function usuarioSupabase() {
  return {
    id: USUARIO.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: USUARIO.email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * La cookie de sesión como la escribe `@supabase/ssr`: `sb-<host>-auth-token`,
 * con el JSON de la sesión en base64url detrás de `base64-`. El host es el de
 * `NEXT_PUBLIC_SUPABASE_URL` (localhost).
 */
export function cookieDeSesion(escenario?: string): { name: string; value: string } {
  const ahora = Math.floor(Date.now() / 1000);
  const sesion = {
    access_token: tokenDePrueba(escenario),
    token_type: 'bearer',
    expires_in: VIGENCIA_S,
    expires_at: ahora + VIGENCIA_S,
    refresh_token: 'refresco-de-mentira',
    user: usuarioSupabase(),
  };
  return { name: 'sb-localhost-auth-token', value: `base64-${b64url(JSON.stringify(sesion))}` };
}

/** El escenario de un pedido a la API, leído del token (sin verificar: es de mentira). */
export function escenarioDe(authorization: string | undefined): string {
  const payload = authorization?.replace(/^Bearer /, '').split('.')[1];
  if (!payload) return 'base';
  try {
    const { escenario } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      escenario?: string;
    };
    return escenario ?? 'base';
  } catch {
    return 'base';
  }
}
