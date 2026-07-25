import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';

/**
 * Pantalla que muestra el service worker cuando una navegación no llega a la
 * red. Es la única página que se guarda en caché, así que no puede depender de
 * datos: todo lo que se ve acá es estático.
 */
export const metadata = { title: 'Sin conexión · Inmobiliaria Inteligente' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-2xl">
            📡
          </div>
          <CardTitle>Sin conexión</CardTitle>
          <CardDescription>
            No pudimos conectarnos. Revisá tu conexión a internet y volvé a intentar: la app carga
            los datos en el momento, así que necesita estar conectada.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
