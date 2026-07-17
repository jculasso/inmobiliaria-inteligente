import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../lib/api';
import { getKpisResumen } from '../lib/tablero-api';
import { createClient } from '../lib/supabase/server';
import { alcanceDeModulo } from '../lib/rbac';
import { HomeView } from '../components/home-view';
import { LogoutButton } from '../components/logout-button';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Sin sesión: Home en modo invitado (login embebido + cards apagadas).
  if (!session) {
    return <HomeView sesion={null} />;
  }

  try {
    const principal = await getMe(session.access_token);

    let volumenAnual: number | undefined;
    if (alcanceDeModulo(principal.roles) !== null) {
      try {
        const resumen = await getKpisResumen(session.access_token, { anio: new Date().getFullYear() });
        volumenAnual = resumen.anual.volumen;
      } catch {
        // Preview opcional para la card del Tablero: si falla, se omite sin romper la Home.
      }
    }

    return (
      <HomeView sesion={{ email: principal.email, roles: principal.roles, volumenAnual }} />
    );
  } catch (err) {
    const message =
      err instanceof MeError
        ? err.message
        : 'No se pudo cargar tu perfil. Intentá de nuevo en unos minutos.';

    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Tu cuenta no está habilitada todavía</CardTitle>
            <CardDescription>
              Iniciaste sesión con Supabase, pero tu usuario aún no está vinculado a un tenant de
              la plataforma. Pedile a un administrador que te dé de alta. ({message})
            </CardDescription>
          </CardHeader>
          <div>
            <LogoutButton />
          </div>
        </Card>
      </main>
    );
  }
}
