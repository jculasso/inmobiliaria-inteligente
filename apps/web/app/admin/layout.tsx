import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AuthPrincipal } from '@vacker/types';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../../lib/api';
import { createClient } from '../../lib/supabase/server';
import { LogoutButton } from '../../components/logout-button';
import { AdminLogin } from '../../components/admin/admin-login';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Sin sesión: /admin muestra su PROPIA pantalla de login (no rebota a la
  // Home; ver middleware.ts, que deja pasar /admin justamente para esto).
  // Tras loguear, AdminLogin hace router.refresh() y este layout se vuelve a
  // ejecutar ya con sesión. Se distingue "sin sesión" (login) de "sesión pero
  // falló /me" (error visible más abajo), como en /tablero/layout.tsx.
  if (!session) return <AdminLogin />;

  let principal: AuthPrincipal;
  try {
    principal = await getMe(session.access_token);
  } catch (err) {
    const message = err instanceof MeError ? err.message : 'No se pudo cargar tu perfil.';
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No se pudo cargar la administración</CardTitle>
            <CardDescription>{message} Probá recargar la página.</CardDescription>
          </CardHeader>
          <LogoutButton redirectTo="/admin" />
        </Card>
      </main>
    );
  }

  if (!principal.roles.includes('admin_plataforma')) {
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
          <span className="text-sm text-muted">{principal.email}</span>
          <LogoutButton redirectTo="/admin" />
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </main>
  );
}
