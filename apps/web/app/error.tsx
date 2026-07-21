'use client';

import { Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';

/**
 * Boundary de error de la Home. Antes, cualquier falla al cargar el perfil
 * (incluida una demora/timeout de red hacia la API, muy real con el free
 * tier de Render) se mostraba como "tu cuenta no está habilitada" — un
 * mensaje falso y confuso. Ahora ese caso llega acá con un mensaje correcto
 * y la posibilidad de reintentar sin tener que recargar a mano.
 */
export default function HomeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No pudimos conectar con el servidor</CardTitle>
          <CardDescription>
            Puede tardar unos segundos en responder la primera vez. Probá de nuevo en un momento.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="primary" onClick={reset}>
            Reintentar
          </Button>
        </div>
      </Card>
    </main>
  );
}
