import Link from 'next/link';
import type { Rol } from '@vacker/types';
import type { BadgeVariant } from '@vacker/ui';
import { alcanceDeModulo, etiquetaDeAlcance } from '../lib/rbac';
import { fmtUSD } from '../lib/format';
import { ModuleCard } from './home/module-card';
import { LoginPanel } from './home/login-panel';
import { LogoutButton } from './logout-button';

interface Modulo {
  nombre: string;
  descripcion: string;
  icono: string;
  estado: BadgeVariant;
  href: string | null;
}

const MODULOS: Modulo[] = [
  {
    nombre: 'Tablero Comercial',
    descripcion: 'KPIs, ranking de vendedores y seguimiento de objetivos.',
    icono: '📊',
    estado: 'activo',
    href: '/tablero',
  },
  {
    nombre: 'Tasador',
    descripcion: 'Valuación asistida de propiedades.',
    icono: '🏷️',
    estado: 'activo',
    href: '/tasador',
  },
  {
    nombre: 'To Do List',
    descripcion: 'Agenda por vendedor sincronizada con Google Calendar.',
    icono: '🗓️',
    estado: 'soon',
    href: null,
  },
];

export interface HomeViewProps {
  /** `null` = modo invitado (sin sesión): todas las cards se ven apagadas. */
  sesion: { email: string; roles: Rol[]; volumenAnual?: number } | null;
}

export function HomeView({ sesion }: HomeViewProps) {
  const bloqueada = sesion === null;
  const alcance = sesion ? alcanceDeModulo(sesion.roles) : null;
  const anio = new Date().getFullYear();

  return (
    <main className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-red to-brand-red-dark shadow-lg shadow-brand-red/20">
            <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
              <path d="M10 12 H90 V88 L50 66 L10 88 Z" fill="#fff" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-red">
              Inmobiliaria Inteligente
            </p>
            <h1 className="text-3xl font-extrabold text-ink">Vacker · Plataforma 2.0</h1>
          </div>
        </div>

        {sesion && (
          <div className="flex items-center gap-3">
            {sesion.roles.includes('admin_plataforma') && (
              <Link
                href="/admin"
                className="text-sm font-semibold text-brand-red hover:underline"
              >
                Administración →
              </Link>
            )}
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white">
                {sesion.email.slice(0, 2).toUpperCase()}
              </span>
              {sesion.email}
            </div>
            <LogoutButton />
          </div>
        )}
      </header>

      <p className="mt-4 max-w-2xl text-muted">
        {sesion
          ? 'Centro de operaciones de Vacker. Cada usuario ve los módulos habilitados según su rol.'
          : 'Centro de operaciones de Vacker. Iniciá sesión para desbloquear tus módulos.'}
      </p>

      <div className={`mt-10 grid gap-6 ${bloqueada ? 'items-start lg:grid-cols-[360px_1fr]' : ''}`}>
        {bloqueada && <LoginPanel />}

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <ModuleCard
              key={m.nombre}
              nombre={m.nombre}
              descripcion={m.descripcion}
              icono={m.icono}
              estado={m.estado}
              href={m.href}
              bloqueada={bloqueada}
              habilitado={m.estado === 'activo' && alcance !== null}
              preview={
                m.href === '/tablero' && sesion?.volumenAnual !== undefined ? (
                  <div className="rounded-lg bg-surface px-3 py-2 text-xs">
                    <span className="font-bold text-ink">{fmtUSD(sesion.volumenAnual)}</span>{' '}
                    <span className="text-muted">volumen {anio}</span>
                    {alcance && <span className="ml-1 text-muted">· {etiquetaDeAlcance(alcance)}</span>}
                  </div>
                ) : undefined
              }
            />
          ))}
        </section>
      </div>
    </main>
  );
}
