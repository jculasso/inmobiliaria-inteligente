import type { ReactNode } from 'react';
import Link from 'next/link';
import type { AuthPrincipal } from '@vacker/types';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../../lib/api';
import { createClient } from '../../lib/supabase/server';
import { LogoutButton } from '../../components/logout-button';
import { AdminLogin } from '../../components/admin/admin-login';
import { AdminNav } from '../../components/admin/admin-nav';
import { MarcaPlataforma } from '../../components/marca-plataforma';
import { marcaPlataformaStyle } from '../../lib/tenant-style';

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
            ← Volver al inicio
          </Link>
        </Card>
      </main>
    );
  }

  return (
    // Los colores de la plataforma (azul), no los de una inmobiliaria: el panel
    // es nuestro. Y los márgenes de los módulos, que en el teléfono entran.
    <main
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 print:px-0 print:py-0"
      style={marcaPlataformaStyle()}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <MarcaPlataforma />
          <h1 className="mt-1 text-xl font-extrabold text-ink sm:text-2xl">
            Administración de plataforma
          </h1>
        </div>
        <div className="flex max-w-full flex-col items-end gap-2">
          <span className="min-w-0 max-w-full truncate text-sm text-muted">{principal.email}</span>
          <LogoutButton redirectTo="/admin" />
        </div>
      </div>

      <div className="mt-6 print:hidden">
        <AdminNav />
      </div>

      <div className="mt-6">{children}</div>
    </main>
  );
}
