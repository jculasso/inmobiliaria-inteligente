import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from './lib/supabase/env';

const PUBLIC_PATHS = ['/'];

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
  const claims = data?.claims;

  // "/" es pública: el login vive embebido ahí (ver app/page.tsx). El resto
  // de las rutas (p. ej. /tablero/*) exige sesión y redirige a la Home.
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!claims && !isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
