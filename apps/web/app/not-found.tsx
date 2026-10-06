import Link from 'next/link';
import { Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';

/**
 * La página que no existe. Sin esto Next mostraba su 404 en inglés y sin
 * ningún link: instalada como app, sin barra del navegador, era un callejón
 * sin salida (revisión del 6/10/2026).
 */
export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No encontramos esta página</CardTitle>
          <CardDescription>
            Puede que el link esté mal, o que lo que buscabas ya no exista.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="primary" asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
