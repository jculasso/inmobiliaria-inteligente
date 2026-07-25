import type { ReactNode } from 'react';

// Piezas compartidas por los formularios del panel de admin (tenants y
// usuarios), con el mismo tratamiento visual que el form de operaciones:
// secciones en tarjetas, título con ícono y campos en grilla.

export const inputClass =
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface disabled:text-muted';

/** Tarjeta con título — agrupa campos relacionados dentro del modal. */
export function Seccion({
  titulo,
  icono,
  full,
  children,
}: {
  titulo: string;
  icono: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-brand border border-line bg-white px-3 py-2.5 ${full ? 'sm:col-span-2' : ''}`}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-red">
        <span aria-hidden>{icono}</span>
        {titulo}
      </p>
      {children}
    </div>
  );
}

/** Campo con etiqueta arriba. `hint` explica el porqué del dato cuando no es obvio. */
export function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs leading-snug text-muted">{hint}</span>}
    </label>
  );
}

/** Check con etiqueta y descripción — usado para módulos y roles. */
export function CheckCard({
  checked,
  onChange,
  titulo,
  descripcion,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  descripcion?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-brand border px-2.5 py-2 transition-colors ${
        checked ? 'border-brand-red bg-brand-red/5' : 'border-line hover:bg-surface'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{titulo}</span>
        {descripcion && <span className="block text-xs leading-snug text-muted">{descripcion}</span>}
      </span>
    </label>
  );
}
