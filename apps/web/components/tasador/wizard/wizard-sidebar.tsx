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
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-r border-line bg-white p-5">
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

      <nav className="flex flex-col gap-1">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onCambiar(s.id)}
            className={`flex items-center gap-2.5 rounded-brand px-3 py-2.5 text-left text-sm transition-colors ${
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
            {s.nombre}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="rounded-brand border border-brand-red/30 bg-brand-red/5 p-3 text-xs text-brand-red">
          {error}
        </div>
      )}
    </aside>
  );
}
