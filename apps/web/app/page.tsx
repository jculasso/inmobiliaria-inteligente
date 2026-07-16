import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import type { BadgeVariant } from '@vacker/ui';

const modulos: { nombre: string; descripcion: string; estado: BadgeVariant }[] = [
  {
    nombre: 'Tablero Comercial',
    descripcion: 'KPIs, ranking de vendedores y seguimiento de objetivos.',
    estado: 'activo',
  },
  {
    nombre: 'Tasador',
    descripcion: 'Valuación asistida de propiedades.',
    estado: 'dev',
  },
  {
    nombre: 'To Do List',
    descripcion: 'Agenda por vendedor sincronizada con Google Calendar.',
    estado: 'soon',
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">
        Inmobiliaria Inteligente
      </p>
      <h1 className="mt-2 text-4xl font-extrabold text-ink">Vacker · Plataforma 2.0</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Fundaciones del monorepo listas. Este shell se reemplaza por la Home autenticada en el
        Paso 4.
      </p>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => (
          <Card key={m.nombre}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{m.nombre}</CardTitle>
                <Badge variant={m.estado} />
              </div>
              <CardDescription>{m.descripcion}</CardDescription>
            </CardHeader>
            <Button variant={m.estado === 'activo' ? 'primary' : 'secondary'} disabled={m.estado !== 'activo'}>
              {m.estado === 'activo' ? 'Entrar' : 'No disponible'}
            </Button>
          </Card>
        ))}
      </section>
    </main>
  );
}
