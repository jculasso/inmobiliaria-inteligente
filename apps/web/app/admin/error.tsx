'use client';

import Link from 'next/link';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';

/**
 * Boundary de error del segmento `/admin` (App Router). Sin esto, un error
 * no controlado reemplaza toda la página (incluido el header con el link a
 * Home) por la pantalla de crash genérica de Next — sin forma de volver.
 */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Algo salió mal en Administración</CardTitle>
          <CardDescription>
            Ocurrió un error inesperado. Podés reintentar o volver al inicio.
          </CardDescription>
        </CardHeader>
        <div className="flex gap-2 px-6 pb-6">
          <Button variant="secondary" onClick={reset}>
            Reintentar
          </Button>
          <Button variant="primary" asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
