import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AuthPrincipal } from '@vacker/types';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../../lib/api';
import { createClient } from '../../lib/supabase/server';
import { LogoutButton } from '../../components/logout-button';
import { TableroNav } from '../../components/tablero/tablero-nav';

export default async function TableroLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  let principal: AuthPrincipal;
  try {
    principal = await getMe(session.access_token);
  } catch (err) {
    const message = err instanceof MeError ? err.message : 'No se pudo cargar tu perfil.';
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Tu cuenta no está habilitada todavía</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <LogoutButton />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-red hover:underline"
          >
            ⌂ Inmobiliaria Inteligente
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold text-ink">Tablero Comercial</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-sm text-muted">{principal.email}</span>
          <LogoutButton />
        </div>
      </div>

      <div className="mt-6">
        <TableroNav roles={principal.roles} />
      </div>

      <div className="mt-6">{children}</div>
    </main>
  );
}
