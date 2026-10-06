import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { requireServerPrincipal } from '../../lib/server-principal';
import { CambiarClaveForm } from '../../components/cambiar-clave-form';
import { LogoutButton } from '../../components/logout-button';
import { CLASE_FOCO } from '../../components/piezas';
import { tenantBrandStyle } from '../../lib/tenant-style';

export default async function CambiarClavePage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) redirect('/');

  const obligatorio = ctx.principal.debeCambiarPassword;

  return (
    // Con el color de la inmobiliaria, como el resto de las pantallas con
    // sesión: el botón salía en el rojo de Vacker en todas.
    <main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 py-10"
      style={tenantBrandStyle(ctx.principal.tenant.config)}
    >
      {/*
        Cambiarla por gusto es una pantalla más: tiene que haber un camino de
        vuelta que no sea el botón Atrás del navegador (en la app instalada no
        hay). Cuando es obligatoria no: no hay a dónde volver sin elegirla.
      */}
      {!obligatorio && (
        <Link
          href="/"
          className={`w-fit rounded text-sm font-semibold text-muted hover:text-ink hover:underline ${CLASE_FOCO}`}
        >
          ← Volver al inicio
        </Link>
      )}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{obligatorio ? 'Elegí tu contraseña' : 'Cambiar contraseña'}</CardTitle>
          <CardDescription>
            {obligatorio
              ? 'Estás usando la contraseña temporal que te dieron. Elegí una propia para continuar: nadie más va a conocerla.'
              : 'Ingresá tu contraseña actual y elegí una nueva.'}
          </CardDescription>
        </CardHeader>

        <CambiarClaveForm obligatorio={obligatorio} />

        {obligatorio && (
          <div className="mt-4 border-t border-line pt-3">
            <LogoutButton />
          </div>
        )}
      </Card>
    </main>
  );
}
