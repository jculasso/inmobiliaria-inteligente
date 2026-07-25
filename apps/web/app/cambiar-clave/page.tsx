import { redirect } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { requireServerPrincipal } from '../../lib/server-principal';
import { CambiarClaveForm } from '../../components/cambiar-clave-form';
import { LogoutButton } from '../../components/logout-button';

export default async function CambiarClavePage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) redirect('/');

  const obligatorio = ctx.principal.debeCambiarPassword;

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
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
