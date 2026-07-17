import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import { getMe, MeError } from '../lib/api';
import { createClient } from '../lib/supabase/server';
import { HomeView } from '../components/home-view';
import { LogoutButton } from '../components/logout-button';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // El middleware ya garantiza que haya sesión para llegar acá; esto es defensivo.
  if (!session) {
    return null;
  }

  try {
    const principal = await getMe(session.access_token);
    return <HomeView email={principal.email} roles={principal.roles} />;
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
