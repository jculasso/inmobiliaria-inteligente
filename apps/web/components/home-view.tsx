import type { ModuloKey, PlanTenant, Rol, TenantConfig } from '@vacker/types';
import { MODULOS_POR_PLAN } from '@vacker/types';
import { Avatar, type BadgeVariant } from '@vacker/ui';
import { alcanceDeModulo, etiquetaDeAlcance } from '../lib/rbac';
import { fmtUSD } from '../lib/format';
import { tenantBrandStyle } from '../lib/tenant-style';
import { ModuleCard } from './home/module-card';
import { LoginPanel } from './home/login-panel';
import { LogoutButton } from './logout-button';

interface Modulo {
  key: ModuloKey;
  nombre: string;
  descripcion: string;
  icono: string;
  estado: BadgeVariant;
  href: string | null;
}

const MODULOS: Modulo[] = [
  {
    key: 'tablero',
    nombre: 'Tablero Comercial',
    descripcion: 'KPIs, ranking de vendedores y seguimiento de objetivos.',
    icono: '📊',
    estado: 'activo',
    href: '/tablero',
  },
  {
    key: 'tasador',
    nombre: 'Tasador',
    descripcion: 'Valuación asistida de propiedades.',
    icono: '🏷️',
    estado: 'activo',
    href: '/tasador',
  },
  {
    key: 'todo',
    nombre: 'To Do List',
    descripcion: 'Agenda por vendedor sincronizada con Google Calendar.',
    icono: '🗓️',
    estado: 'soon',
    href: null,
  },
];

export interface HomeViewProps {
  /** `null` = modo invitado (sin sesión): todas las cards se ven apagadas. */
  sesion: {
    email: string;
    nombre: string;
    fotoUrl: string | null;
    roles: Rol[];
    volumenAnual?: number;
    tenant: { nombre: string; plan: PlanTenant; config: TenantConfig };
  } | null;
}

export function HomeView({ sesion }: HomeViewProps) {
  const bloqueada = sesion === null;
  const alcance = sesion ? alcanceDeModulo(sesion.roles) : null;
  const anio = new Date().getFullYear();
  const config = sesion?.tenant.config;
  const modulosDelPlan = sesion ? MODULOS_POR_PLAN[sesion.tenant.plan] : [];
  const nombreMarca = sesion ? (config?.nombreCorto ?? sesion.tenant.nombre) : 'Inmobiliaria Inteligente';

  return (
    <main className="mx-auto max-w-6xl px-6 py-14 sm:py-16" style={tenantBrandStyle(config)}>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {config?.logoUrl ? (
            <Avatar nombre={nombreMarca} fotoUrl={config.logoUrl} size="lg" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-red to-brand-red-dark shadow-lg shadow-brand-red/20">
              <svg viewBox="0 0 100 100" className="h-8 w-8" aria-hidden>
                <path d="M10 12 H90 V88 L50 66 L10 88 Z" fill="#fff" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-red">
              Inmobiliaria Inteligente
            </p>
            <h1 className="text-3xl font-extrabold text-ink">{nombreMarca} · Plataforma 2.0</h1>
          </div>
        </div>

        {sesion && (
          <div className="flex max-w-full flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-2.5 text-sm text-muted">
              <Avatar nombre={sesion.nombre} fotoUrl={sesion.fotoUrl} size="md" />
              <span className="min-w-0 truncate">{sesion.email}</span>
            </div>
            <LogoutButton />
          </div>
        )}
      </header>

      <p className="mt-4 max-w-2xl text-muted">
        {sesion
          ? `Centro de operaciones de ${nombreMarca}. Cada usuario ve los módulos habilitados según su rol.`
          : 'Iniciá sesión para desbloquear los módulos de tu inmobiliaria.'}
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
              habilitado={m.estado === 'activo' && alcance !== null && modulosDelPlan.includes(m.key)}
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
