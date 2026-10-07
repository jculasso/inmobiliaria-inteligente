import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { AuthPrincipal, ModuloKey } from '@vacker/types';
import { Avatar, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../lib/api';
import { createClient } from '../lib/supabase/server';
import { tenantBrandStyle } from '../lib/tenant-style';
import { LogoutButton } from './logout-button';
import { MarcaPlataforma } from './marca-plataforma';
import { MenuModulos } from './menu-modulos';

/*
 * El marco de cada módulo: el perfil, los controles de acceso y el encabezado.
 * Estaba copiado en seis layouts, y las copias se habían separado: tres
 * módulos no controlaban si la inmobiliaria los tenía contratados, y uno decía
 * «activarla» por «activarlo» (revisión del 6/10/2026).
 */

type Resultado = { principal: AuthPrincipal } | { pantalla: ReactNode } | null;

/**
 * El perfil para el layout de un módulo, o la pantalla que corresponde si no
 * se puede entrar: sin sesión, cuenta no habilitada, módulo no contratado. Con
 * clave temporal, se va a cambiarla antes de entrar a cualquier módulo.
 */
export async function principalDelModulo(modulo: ModuloKey, nombre: string): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  let principal: AuthPrincipal;
  try {
    principal = await getMe(session.access_token);
  } catch (err) {
    // Solo MeError es un problema real de la cuenta (401/403). Lo demás
    // (Render despertando, red) va a error.tsx, que ofrece reintentar.
    if (!(err instanceof MeError)) throw err;
    return { pantalla: <CuentaNoHabilitada mensaje={err.message} /> };
  }

  // El módulo se contrata por inmobiliaria. La API ya rechaza con 403; esto
  // explica por qué en vez de mostrar una pantalla vacía.
  if (!principal.tenant.modulos[modulo])
    return { pantalla: <ModuloNoHabilitado nombre={nombre} /> };

  if (principal.debeCambiarPassword) redirect('/cambiar-clave');
  return { principal };
}

export function CuentaNoHabilitada({ mensaje }: { mensaje: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Tu cuenta no está habilitada todavía</CardTitle>
          <CardDescription>{mensaje}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <LogoutButton />
        </div>
      </Card>
    </main>
  );
}

export function ModuloNoHabilitado({ nombre }: { nombre: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>El módulo {nombre} no está habilitado</CardTitle>
          <CardDescription>
            Tu inmobiliaria todavía no tiene contratado este módulo. Escribinos si querés activarlo.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Link href="/" className="text-sm font-semibold text-brand-red hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </Card>
    </main>
  );
}

/**
 * El encabezado y el contenido de un módulo: logo de la inmobiliaria, la marca
 * de la plataforma (que lleva al inicio), el título con el menú de módulos y
 * la cuenta. `nav` va debajo; `className` cambia el contenedor (To Do usa el
 * alto de la pantalla).
 */
export function MarcoModulo({
  principal,
  titulo,
  nav,
  children,
  className = 'mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-10',
  contenido = 'mt-6',
}: {
  principal: AuthPrincipal;
  titulo: string;
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
  contenido?: string;
}) {
  return (
    <main className={className} style={tenantBrandStyle(principal.tenant.config)}>
      {/* En el teléfono, una sola fila compacta: logo más chico, sin el email
          (queda el avatar) y «Cerrar sesión» como ícono. En 375px la cabecera
          empujaba el título de la página hasta y≈275 de 812 (prueba en
          producción, 6/10/2026). Desde `sm`, igual que siempre. */}
      <div className="flex items-center justify-between gap-3 sm:flex-wrap sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Avatar
            nombre={principal.tenant.nombre}
            fotoUrl={principal.tenant.config.logoUrl}
            size="md"
            className="sm:hidden"
          />
          <Avatar
            nombre={principal.tenant.nombre}
            fotoUrl={principal.tenant.config.logoUrl}
            size="lg"
            className="max-sm:hidden"
          />
          <div className="min-w-0">
            <MarcaPlataforma />
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{titulo}</h1>
              <MenuModulos modulos={principal.tenant.modulos} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:max-w-full sm:flex-col sm:items-end">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="hidden min-w-0 truncate text-sm text-muted sm:inline">
              {principal.email}
            </span>
            <Avatar
              nombre={principal.nombre}
              fotoUrl={principal.fotoUrl}
              size="md"
              title={principal.email}
              className="max-sm:h-10 max-sm:w-10"
            />
          </div>
          <LogoutButton compacto />
        </div>
      </div>
      {nav && <div className="mt-3 sm:mt-5">{nav}</div>}
      <div className={contenido}>{children}</div>
    </main>
  );
}
