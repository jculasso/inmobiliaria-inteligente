'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';

/**
 * La pantalla de un error de servidor, igual en todos los módulos.
 *
 * «Reintentar» vuelve a pedir la página al servidor: con `reset()` solo, Next
 * 15 vuelve a dibujar el mismo error, y el error típico acá es la API
 * despertando en Render. Y siempre hay «Volver al inicio»: instalada como app
 * no hay barra del navegador ni botón de recargar, así que sin esto quedaba
 * encerrado (revisión PWA del 6/10/2026).
 */
export function PantallaError({
  titulo,
  descripcion,
  reset,
}: {
  titulo: string;
  descripcion: string;
  reset: () => void;
}) {
  const router = useRouter();
  const [reintentando, startTransition] = useTransition();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{descripcion}</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2 px-6 pb-6">
          <Button
            variant="secondary"
            disabled={reintentando}
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            {reintentando ? 'Reintentando…' : 'Reintentar'}
          </Button>
          <Button variant="primary" asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
