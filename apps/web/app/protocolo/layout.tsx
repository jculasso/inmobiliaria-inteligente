import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { AuthPrincipal } from '@vacker/types';
import { Avatar, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../../lib/api';
import { createClient } from '../../lib/supabase/server';
import { tenantBrandStyle } from '../../lib/tenant-style';
import { LogoutButton } from '../../components/logout-button';
import { MenuModulos } from '../../components/menu-modulos';
import { ProtocoloNav } from '../../components/protocolo/protocolo-nav';

export default async function ProtocoloLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  let principal: AuthPrincipal;
  try {
    principal = await getMe(session.access_token);
  } catch (err) {
    // Solo MeError es un problema real de la cuenta (p. ej. 401 sin tenant
    // vinculado). Cualquier otro error (timeout/red hacia la API) se
    // relanza para que lo resuelva error.tsx con un mensaje correcto.
    if (!(err instanceof MeError)) throw err;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Tu cuenta no está habilitada todavía</CardTitle>
            <CardDescription>{err.message}</CardDescription>
          </CardHeader>
          <LogoutButton />
        </Card>
      </main>
    );
  }

  // El módulo se contrata por inmobiliaria. La API ya rechaza con 403, pero
  // sin esto la pantalla se vería vacía en vez de explicar por qué.
  if (!principal.tenant.modulos.protocolo) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>El módulo Protocolo no está habilitado</CardTitle>
            <CardDescription>
              Tu inmobiliaria todavía no tiene contratado el Protocolo 5 Semanas. Escribinos si querés
              activarlo.
            </CardDescription>
          </CardHeader>
          <Link href="/" className="text-sm font-semibold text-brand-red hover:underline">
            ← Volver al inicio
          </Link>
        </Card>
      </main>
    );
  }

  // Clave temporal sin cambiar: no se entra a ningún módulo hasta elegir una
  // propia. El chequeo no cuesta un round trip extra — viaja en el perfil que
  // este layout ya pide.
  if (principal.debeCambiarPassword) redirect('/cambiar-clave');

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10" style={tenantBrandStyle(principal.tenant.config)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar nombre={principal.tenant.nombre} fotoUrl={principal.tenant.config.logoUrl} size="lg" />
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-red hover:underline"
            >
              ⌂ Inmobiliaria Inteligente
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Protocolo 5 Semanas</h1>
              <MenuModulos modulos={principal.tenant.modulos} />
            </div>
          </div>
        </div>
        <div className="flex max-w-full flex-col items-end gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="min-w-0 truncate text-sm text-muted">{principal.email}</span>
            <Avatar nombre={principal.nombre} fotoUrl={principal.fotoUrl} size="md" />
          </div>
          <LogoutButton />
        </div>
      </div>

      <div className="mt-6">
        <ProtocoloNav />
      </div>

      <div className="mt-6">{children}</div>
    </main>
  );
}
