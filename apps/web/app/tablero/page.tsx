import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';

export default function TableroPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Tablero Comercial</CardTitle>
          <CardDescription>
            La API del Tablero ya está lista. Esta vista se conecta a datos reales en el Paso 5.
          </CardDescription>
        </CardHeader>
        <Link href="/" className="text-sm font-semibold text-brand-red">
          Volver a la Home
        </Link>
      </Card>
    </main>
  );
}
