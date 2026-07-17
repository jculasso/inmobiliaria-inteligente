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

  // Refresca el token si hace falta y sincroniza las cookies (necesario en cada request).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "/" es pública: el login vive embebido ahí (ver app/page.tsx). El resto
  // de las rutas (p. ej. /tablero/*) exige sesión y redirige a la Home.
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
