import Link from 'next/link';
import type { Rol } from '@vacker/types';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '@vacker/ui';
import type { BadgeVariant } from '@vacker/ui';
import { alcanceDeModulo, etiquetaDeAlcance } from '../lib/rbac';
import { LogoutButton } from './logout-button';

interface Modulo {
  nombre: string;
  descripcion: string;
  estado: BadgeVariant;
  href: string | null;
}

const MODULOS: Modulo[] = [
  {
    nombre: 'Tablero Comercial',
    descripcion: 'KPIs, ranking de vendedores y seguimiento de objetivos.',
    estado: 'activo',
    href: '/tablero',
  },
  {
    nombre: 'Tasador',
    descripcion: 'Valuación asistida de propiedades.',
    estado: 'dev',
    href: null,
  },
  {
    nombre: 'To Do List',
    descripcion: 'Agenda por vendedor sincronizada con Google Calendar.',
    estado: 'soon',
    href: null,
  },
];

export interface HomeViewProps {
  email: string;
  roles: Rol[];
}

export function HomeView({ email, roles }: HomeViewProps) {
  const alcance = alcanceDeModulo(roles);
  const iniciales = email.slice(0, 2).toUpperCase();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">
            Inmobiliaria Inteligente
          </p>
          <h1 className="mt-2 text-4xl font-extrabold text-ink">Vacker · Plataforma 2.0</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Centro de operaciones de Vacker. Cada usuario ve los módulos habilitados según su rol.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white">
              {iniciales}
            </span>
            {email}
          </div>
          <LogoutButton />
        </div>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => {
          const habilitado = m.estado === 'activo' && m.href !== null && alcance !== null;
          return (
            <Card key={m.nombre}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{m.nombre}</CardTitle>
                  <Badge variant={m.estado} />
                </div>
                <CardDescription>{m.descripcion}</CardDescription>
                {m.estado === 'activo' && alcance && (
                  <p className="text-xs font-semibold text-muted">
                    Tu alcance: {etiquetaDeAlcance(alcance)}
                  </p>
                )}
              </CardHeader>
              {habilitado ? (
                <Button asChild variant="primary">
                  <Link href={m.href as string}>Entrar</Link>
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  No disponible
                </Button>
              )}
            </Card>
          );
        })}
      </section>
    </main>
  );
}
