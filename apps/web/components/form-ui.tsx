import type { ReactNode } from 'react';

// Piezas compartidas por TODOS los formularios de la app: admin, protocolo,
// vendedores, alta de operación, comparables y el wizard de tasación.
//
// Es la única definición a propósito. Llegó a haber cuatro copias de `Campo`
// conviviendo, así que la misma app tenía distinto aspecto de formulario según
// por dónde entraras.
//
// Etiqueta chica en mayúscula y bold arriba, dato en tamaño normal debajo: la
// jerarquía deja escanear un formulario largo de un vistazo. Campos de 40px
// porque 36 quedaba corto para el dedo.

export const inputClass =
  'h-10 w-full rounded-brand border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 disabled:bg-surface disabled:text-muted';

export const textareaClass =
  'min-h-[84px] w-full rounded-brand border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 disabled:bg-surface disabled:text-muted';

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
  requerido = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  /** Marca el campo como obligatorio con un asterisco rojo. */
  requerido?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
        {label}
        {requerido && <span className="ml-0.5 text-brand-red">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-muted">{hint}</span>}
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

/** Input de monto con el prefijo de moneda adentro, como en el form de operaciones. */
export function MoneyInput({
  value,
  onChange,
  moneda = 'USD',
}: {
  value: string;
  onChange: (v: string) => void;
  moneda?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
        {moneda}
      </span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pl-11 text-right font-semibold`}
      />
    </div>
  );
}

/** Opción excluyente con descripción — para elegir entre pocos valores. */
export function OpcionCard({
  seleccionada,
  onSelect,
  titulo,
  descripcion,
}: {
  seleccionada: boolean;
  onSelect: () => void;
  titulo: string;
  descripcion?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={seleccionada}
      className={`flex flex-col items-start rounded-brand border px-2.5 py-2 text-left transition-colors ${
        seleccionada ? 'border-brand-red bg-brand-red/5' : 'border-line hover:bg-surface'
      }`}
    >
      <span className={`text-sm font-medium ${seleccionada ? 'text-brand-red-dark' : 'text-ink'}`}>
        {titulo}
      </span>
      {descripcion && <span className="text-xs leading-snug text-muted">{descripcion}</span>}
    </button>
  );
}
