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
    // getMe y el preview de volumen van en paralelo (antes: uno esperaba al
    // otro). El preview es opcional y se descarta solo si el usuario termina
    // sin acceso al Tablero — pedirlo en paralelo cuesta como mucho una
    // consulta de más que se ignora, pero corta a la mitad la espera típica
    // (con la latencia cross-region hacia la base, esto se sentía bastante
    // en el primer render después de loguearse).
    const [principal, resumen] = await Promise.all([
      getMe(session.access_token),
      getKpisResumen(session.access_token, { anio: new Date().getFullYear() }).catch(() => null),
    ]);

    const volumenAnual =
      alcanceDeModulo(principal.roles) !== null ? (resumen?.anual.volumen ?? undefined) : undefined;

    return (
      <HomeView
        sesion={{ email: principal.email, roles: principal.roles, volumenAnual, tenant: principal.tenant }}
      />
    );
  } catch (err) {
    // Solo MeError significa "la API respondió, pero mal" (p. ej. 401 =
    // cuenta sin tenant vinculado) — ahí sí aplica este mensaje. Cualquier
    // otro error (fetch que nunca llegó a responder: timeout, red caída,
    // Render todavía despertando) NO es un problema de la cuenta; se
    // relanza para que lo resuelva app/error.tsx con un mensaje correcto y
    // un botón de reintentar, en vez de decirle al usuario algo falso.
    if (!(err instanceof MeError)) throw err;

    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Tu cuenta no está habilitada todavía</CardTitle>
            <CardDescription>
              Iniciaste sesión con Supabase, pero tu usuario aún no está vinculado a un tenant de
              la plataforma. Pedile a un administrador que te dé de alta. ({err.message})
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
