import type { ModuloKey, ModulosTenant, PlanTenant, Rol, TenantConfig } from '@vacker/types';
import { Avatar, type BadgeVariant } from '@vacker/ui';
import { puedeExportarDatos, alcanceDeModulo } from '../lib/rbac';
import { marcaPlataformaStyle, tenantBrandStyle } from '../lib/tenant-style';
import { ModuleCard } from './home/module-card';
import { LoginPanel } from './home/login-panel';
import { TableroVolumenPreview } from './home/tablero-volumen-preview';
import { LogoutButton } from './logout-button';
import { InstalarApp } from './pwa/instalar-app';
import { BotonExportarDatos } from './boton-exportar-datos';

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
    estado: 'activo',
    href: '/todo',
  },
  {
    key: 'protocolo',
    nombre: 'Protocolo 5 Semanas',
    descripcion: 'Seguimiento de la comercialización e informe para el propietario.',
    icono: '📋',
    estado: 'activo',
    href: '/protocolo',
  },
];

export interface HomeViewProps {
  /** `null` = modo invitado (sin sesión): todas las cards se ven apagadas. */
  sesion: {
    email: string;
    nombre: string;
    fotoUrl: string | null;
    roles: Rol[];
    tenant: { nombre: string; plan: PlanTenant; modulos: ModulosTenant; config: TenantConfig };
  } | null;
}

export function HomeView({ sesion }: HomeViewProps) {
  const bloqueada = sesion === null;
  const alcance = sesion ? alcanceDeModulo(sesion.roles) : null;
  const anio = new Date().getFullYear();
  const config = sesion?.tenant.config;
  const modulos = sesion?.tenant.modulos;
  const nombreMarca = sesion ? (config?.nombreCorto ?? sesion.tenant.nombre) : 'Inmobiliaria Inteligente';

  /*
   * Sin sesión manda la marca de la PLATAFORMA, no la de un cliente.
   *
   * Antes, sin tenant, todo caía al rojo por defecto —el de Vacker— y lo
   * primero que veía alguien de otra inmobiliaria era la marca de un
   * competidor. Con sesión sí vale la del tenant: ahí ya se sabe quién es.
   */
  const marca = sesion ? tenantBrandStyle(config) : marcaPlataformaStyle();

  return (
    <main
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
      style={marca}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {config?.logoUrl ? (
            <Avatar nombre={nombreMarca} fotoUrl={config.logoUrl} size="lg" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-red to-brand-red-dark shadow-lg shadow-brand-red/20 sm:h-14 sm:w-14">
              {/*
                Sin sesión el cuadrado representa a la plataforma, así que lleva
                su marca —el techo sobre las barras, el mismo del ícono de la
                aplicación—. Con sesión y sin logo cargado está haciendo de la
                inmobiliaria, y ahí queda el marcador genérico.
              */}
              {sesion ? (
                <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
                  <path d="M10 12 H90 V88 L50 66 L10 88 Z" fill="#fff" />
                </svg>
              ) : (
                <svg viewBox="0 0 100 100" className="h-8 w-8" aria-hidden>
                  <path
                    d="M22 50 L50 27 L78 50"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect x="31" y="58" width="9" height="15" rx="3" fill="#fff" opacity=".65" />
                  <rect x="45.5" y="52" width="9" height="21" rx="3" fill="#fff" opacity=".82" />
                  <rect x="60" y="45" width="9" height="28" rx="3" fill="#fff" />
                </svg>
              )}
            </div>
          )}
          <div className="min-w-0">
            {/*
              Este rótulo es el nombre de la PLATAFORMA, no el de la
              inmobiliaria —ese va abajo, en el `h1`—. Va siempre en azul, con
              sesión y sin ella: es la única línea de la pantalla que no cambia
              de un cliente a otro.
            */}
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-plataforma sm:text-xs">
              Inmobiliaria Inteligente
            </p>
            <h1 className="text-xl font-extrabold leading-tight text-ink break-words sm:text-2xl">
              {nombreMarca}
            </h1>
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

      {/* Con sesión no va ningún texto: quien ya entró ve sus módulos abajo y
          no necesita que le expliquen dónde está. La bajada queda solo para
          quien todavía no se logueó. */}
      {!sesion && (
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Iniciá sesión para desbloquear los módulos de tu inmobiliaria.
        </p>
      )}

      {/* Solo con sesión: a un invitado no le sirve instalar algo a lo que no
          puede entrar. Se posiciona solo (banner fijo), sin ocupar lugar. */}
      {sesion && <InstalarApp />}

      <div className={`mt-5 grid gap-5 ${bloqueada ? 'items-start lg:grid-cols-[360px_1fr]' : ''}`}>
        {bloqueada && <LoginPanel />}

        {/* Con sesión, los 4 módulos entran en una fila en desktop: la Home es
            un menú, no debería obligar a scrollear para ver un módulo. */}
        <section className={`grid gap-4 sm:grid-cols-2 ${bloqueada ? 'xl:grid-cols-2' : 'lg:grid-cols-4'}`}>
          {MODULOS.map((m) => {
            const licenciado = bloqueada || modulos?.[m.key] === true;
            const habilitado = m.estado === 'activo' && alcance !== null && licenciado;
            return (
              <ModuleCard
                key={m.nombre}
                nombre={m.nombre}
                descripcion={m.descripcion}
                icono={m.icono}
                estado={m.estado}
                href={m.href}
                bloqueada={bloqueada}
                habilitado={habilitado}
                licenciado={licenciado}
                preview={
                  m.href === '/tablero' && habilitado && alcance ? (
                    <TableroVolumenPreview anio={anio} alcance={alcance} />
                  ) : undefined
                }
              />
            );
          })}
        </section>

        {/* "Sus datos son suyos": va acá, al pie y discreto, no compitiendo con
            los módulos. Solo para la dirección y el admin — el archivo trae la
            cartera entera y las comisiones de cada vendedor. */}
        {sesion && puedeExportarDatos(sesion.roles) && (
          <div className="mt-10 border-t border-line pt-5">
            <BotonExportarDatos />
          </div>
        )}
      </div>
    </main>
  );
}
