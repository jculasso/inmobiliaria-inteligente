'use client';

export const SECCIONES = [
  { id: 1, nombre: 'Datos del informe' },
  { id: 2, nombre: 'Características' },
  { id: 3, nombre: 'Análisis comercial' },
  { id: 4, nombre: 'Comparables' },
  { id: 5, nombre: 'Valores de tasación' },
  { id: 6, nombre: 'Estrategia comercial' },
] as const;

interface Props {
  activa: number;
  onCambiar: (seccion: number) => void;
  error: string | null;
}

/** Sidebar del wizard: 6 secciones numeradas + indicador de progreso + banner de errores. */
export function WizardSidebar({ activa, onCambiar, error }: Props) {
  const progreso = (activa / SECCIONES.length) * 100;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-line bg-white p-4 lg:w-[280px] lg:border-b-0 lg:border-r lg:p-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>Progreso</span>
          <span>
            {activa}/{SECCIONES.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Desde lg: es una lista vertical con los nombres. En pantalla angosta
          los seis nombres no entran de ninguna manera (antes se deslizaba de
          costado, y eso arrastraba todo el formulario), así que quedan solo
          los números y el nombre del paso actual va debajo. */}
      <nav className="flex gap-1 lg:flex-col">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onCambiar(s.id)}
            aria-label={s.nombre}
            aria-current={activa === s.id ? 'step' : undefined}
            className={`flex flex-1 items-center justify-center gap-2.5 rounded-brand px-1 py-2.5 text-sm transition-colors lg:flex-none lg:justify-start lg:px-3 lg:text-left ${
              activa === s.id ? 'bg-brand-red/10 font-semibold text-brand-red' : 'text-ink hover:bg-surface'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                activa === s.id ? 'bg-brand-red text-white' : 'bg-surface text-muted'
              }`}
            >
              {s.id}
            </span>
            <span className="hidden whitespace-nowrap lg:inline">{s.nombre}</span>
          </button>
        ))}
      </nav>

      <p className="-mt-2 text-sm font-bold text-ink lg:hidden">
        {SECCIONES.find((s) => s.id === activa)?.nombre}
      </p>

      {error && (
        <div role="alert" className="rounded-brand border border-brand-red/30 bg-brand-red/5 p-3 text-xs text-brand-red">
          {error}
        </div>
      )}
    </aside>
  );
}
