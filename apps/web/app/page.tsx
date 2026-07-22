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

  // Sin sesión: Home en modo invitado (login embebido + cards apagadas).
  if (!session) {
    return <HomeView sesion={null} />;
  }

  try {
    // Solo `getMe` (liviano) bloquea el render de la Home. El volumen anual del
    // Tablero se pide client-side en `TableroVolumenPreview` — `getKpisResumen`
    // agrega todo el año y es más pesada, así que antes la Home esperaba ese
    // cálculo (más notorio por la latencia cross-region). Ahora la Home aparece
    // al instante y ese stat opcional se completa solo.
    const principal = await getMe(session.access_token);

    return (
      <HomeView
        sesion={{
          email: principal.email,
          nombre: principal.nombre,
          fotoUrl: principal.fotoUrl,
          roles: principal.roles,
          tenant: principal.tenant,
        }}
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
