'use client';

import type { ReactNode } from 'react';

/**
 * Piezas compartidas por los seis pasos del wizard de tasación.
 *
 * El lenguaje visual es el mismo del módulo de Protocolo: etiqueta chica en
 * mayúscula y bold arriba, dato en tamaño normal debajo. Esa jerarquía deja
 * escanear un formulario largo de un vistazo — con la etiqueta del mismo peso
 * que el contenido, los seis pasos se leían como una lista plana.
 */

// El campo es el mismo de toda la app; acá solo viven las piezas propias del
// wizard (encabezado de paso y bloque).
export { Campo, inputClass, textareaClass } from '../../form-ui';

/**
 * Encabezado de paso: número en un círculo rojo + título, con la bajada debajo.
 * Da el mismo punto de entrada visual en los seis pasos.
 */
export function PasoHeader({ numero, titulo, bajada }: { numero: number; titulo: string; bajada?: string }) {
  return (
    <header className="border-b border-line pb-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-red text-xs font-extrabold text-white">
          {numero}
        </span>
        <h2 className="min-w-0 text-lg font-extrabold tracking-tight text-ink">{titulo}</h2>
      </div>
      {bajada && <p className="mt-1.5 text-xs leading-relaxed text-muted">{bajada}</p>}
    </header>
  );
}

/**
 * Agrupa campos afines dentro de un paso. Sin esto, un paso con quince campos
 * es una lista sin respiro.
 */
export function Bloque({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="rounded-brand border border-line bg-white p-4">
      {titulo && (
        <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-brand-red">{titulo}</h3>
      )}
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

export function CheckPills({
  label,
  opciones,
  valores,
  onToggle,
}: {
  label: string;
  opciones: readonly string[];
  valores: string[];
  onToggle: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => {
          const activo = valores.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={activo}
              onClick={() => onToggle(o)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                activo
                  ? 'border-brand-red bg-brand-red/10 text-brand-red'
                  : 'border-line text-muted hover:border-brand-red/40 hover:text-ink'
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
