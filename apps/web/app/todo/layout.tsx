import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AuthPrincipal } from '@vacker/types';
import { Avatar, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../../lib/api';
import { createClient } from '../../lib/supabase/server';
import { tenantBrandStyle } from '../../lib/tenant-style';
import { LogoutButton } from '../../components/logout-button';

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10" style={tenantBrandStyle(principal.tenant.config)}>
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
            <h1 className="mt-1 text-2xl font-extrabold text-ink">To Do List</h1>
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

      <div className="mt-6">{children}</div>
    </main>
  );
}
