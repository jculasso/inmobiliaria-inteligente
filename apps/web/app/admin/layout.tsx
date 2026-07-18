import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { requireServerPrincipal } from '../../lib/server-principal';
import { LogoutButton } from '../../components/logout-button';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requireServerPrincipal();
  if (!ctx) redirect('/');

  if (!ctx.principal.roles.includes('admin_plataforma')) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No tenés acceso a esta sección</CardTitle>
            <CardDescription>
              La administración de la plataforma está reservada al rol admin_plataforma.
            </CardDescription>
          </CardHeader>
          <Link href="/" className="text-sm font-medium text-brand-red hover:underline">
            ← Volver a la Home
          </Link>
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
          <h1 className="mt-1 text-2xl font-extrabold text-ink">Administración de plataforma</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-sm text-muted">{ctx.principal.email}</span>
          <LogoutButton />
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </main>
  );
}
