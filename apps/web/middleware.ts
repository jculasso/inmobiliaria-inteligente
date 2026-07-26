import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './lib/supabase/env';

// `/offline` es la pantalla que muestra el service worker cuando no hay red:
// tiene que ser pública porque se guarda en caché al instalar la app, cuando
// puede no haber sesión — y porque justamente se muestra sin conexión, que es
// cuando el chequeo de sesión tampoco podría hacerse.
const PUBLIC_PATHS = ['/', '/offline'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() verifica el JWT localmente (JWKS cacheado, sin red) porque el
  // proyecto firma con clave asimétrica — a diferencia de getUser(), que
  // manda una request a Supabase en CADA navegación. Con Render y Vercel sin
  // región cercana a Supabase (sa-east-1), ese round trip por click se sentía.
  const { data } = await supabase.auth.getClaims();
  let claims = data?.claims;

  // getClaims() no refresca el token si venció (a diferencia de getUser()) —
  // solo cuando el chequeo local falla vale la pena pagar el round trip: le
  // da a Supabase la chance de refrescarlo con el refresh_token y reescribir
  // las cookies antes de decidir que no hay sesión. En navegación dura (URL
  // directa, bookmark, nueva pestaña) suele ser justo cuando el token ya
  // expiró, así que sin este fallback cualquier ruta protegida rebotaba a la
  // Home aunque la sesión siguiera siendo válida.
  if (!claims) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const retry = await supabase.auth.getClaims();
      claims = retry.data?.claims;
    }
  }

  // "/" es pública: el login vive embebido ahí (ver app/page.tsx). El resto
  // de las rutas (p. ej. /tablero/*) exige sesión y redirige a la Home.
  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.includes(path);
  // /admin tiene su PROPIA pantalla de login (components/admin/admin-login.tsx):
  // no rebota a la Home. Se deja pasar sin sesión y el layout de /admin decide
  // (login si no hay sesión, "sin acceso" si el rol no es admin_plataforma).
  const isAdminPath = path === '/admin' || path.startsWith('/admin/');

  if (!claims && !isPublicPath && !isAdminPath) {
    // Guarda el destino original (ej. /admin) como ?redirect= para que el
    // login embebido en la Home pueda mandar para allá apenas loguees, en
    // vez de dejarte en la Home y que tengas que volver a escribir la URL
    // a mano.
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Los archivos estáticos quedan FUERA del middleware. Sin esta exclusión,
  // pedir /icons/... sin sesión devolvía un redirect al login en vez del
  // archivo: el favicon no cargaba para quien no había entrado, y al sumar la
  // PWA habría pasado lo mismo con el manifest y el service worker — que se
  // piden sin sesión, así que la app directamente no se habría podido instalar.
  //
  // El flyer comercial es el caso más obvio de todos: se lo mandamos a dueños
  // de inmobiliarias que NO tienen cuenta. Si pide sesión, el prospecto abre el
  // link y se encuentra con un login — que es la peor primera impresión posible
  // para un material de venta.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest\\.webmanifest|sw\\.js|flyer-comercial\\.pdf).*)',
  ],
};
