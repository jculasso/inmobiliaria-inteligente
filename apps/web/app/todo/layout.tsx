import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import type { AuthPrincipal } from '@vacker/types';
import { Avatar, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../../lib/api';
import { createClient } from '../../lib/supabase/server';
import { tenantBrandStyle } from '../../lib/tenant-style';
import { LogoutButton } from '../../components/logout-button';
import { MarcaPlataforma } from '../../components/marca-plataforma';
import { MenuModulos } from '../../components/menu-modulos';

export default async function TodoLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  let principal: AuthPrincipal;
  try {
    principal = await getMe(session.access_token);
  } catch (err) {
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

  // Clave temporal sin cambiar: no se entra a ningún módulo hasta elegir una
  // propia. El chequeo no cuesta un round trip extra — viaja en el perfil que
  // este layout ya pide.
  if (principal.debeCambiarPassword) redirect('/cambiar-clave');

  return (
    /* Alto fijo a la pantalla: el calendario tiene que entrar entero, y lo que
       scrollea es la grilla de horas por dentro, no la página. `dvh` y no `vh`
       porque en el celular la barra del navegador cambia el alto real. */
    <main
      className="mx-auto flex h-dvh max-w-4xl flex-col px-4 py-8 sm:px-6 sm:py-10"
      style={tenantBrandStyle(principal.tenant.config)}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar nombre={principal.tenant.nombre} fotoUrl={principal.tenant.config.logoUrl} size="lg" />
          <div>
            <MarcaPlataforma />
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-ink sm:text-2xl">To Do List</h1>
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

      <div className="mt-6 flex min-h-0 flex-1 flex-col">{children}</div>
    </main>
  );
}
