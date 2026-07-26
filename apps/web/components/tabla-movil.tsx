import type { ReactNode } from 'react';

/**
 * Piezas compartidas para reemplazar las tablas anchas por tarjetas en el
 * celular.
 *
 * Una tabla de 7 u 11 columnas no entra en 375px: medida, la de operaciones
 * ocupa 1107px, tres pantallas. Envolverla en un panel que se desliza la hace
 * "usable", pero ese panel se corre 766px de costado justo mientras el dedo
 * scrollea hacia abajo — ese arrastre diagonal es el "baile" que hace sentir
 * inestable a la app. Además, en esos anchos el vendedor ve una columna y
 * media: para leer el precio tiene que deslizar a ciegas.
 *
 * En pantalla angosta cada fila pasa a ser una tarjeta: no queda nada que
 * correr de costado y se ve más información que antes, no menos.
 */

/**
 * Contenedor de la lista de tarjetas. Solo se muestra en pantallas angostas.
 * `etiqueta` la nombra para lectores de pantalla (y deja que los tests digan
 * qué vista están mirando).
 */
export function ListaTarjetas({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <ul aria-label={etiqueta} className="flex flex-col gap-2 p-3 sm:hidden">
      {children}
    </ul>
  );
}

/** La tabla original, reservada para pantallas donde sí entra. */
export function TablaAncha({ children }: { children: ReactNode }) {
  return <div className="hidden overflow-x-auto overscroll-x-contain sm:block">{children}</div>;
}

/** Una fila como tarjeta. `onClick` la vuelve accionable (equivale a tocar la fila). */
export function Tarjeta({
  children,
  onClick,
  destacada = false,
  titulo,
}: {
  children: ReactNode;
  onClick?: () => void;
  destacada?: boolean;
  titulo?: string;
}) {
  const clases = `block rounded-xl border px-3 py-2.5 text-left ${
    destacada ? 'border-brand-red/30 bg-brand-red/5' : 'border-line bg-white'
  }`;

  if (!onClick) return <li className={clases}>{children}</li>;
  return (
    <li>
      <button type="button" onClick={onClick} title={titulo} className={`${clases} w-full active:bg-surface`}>
        {children}
      </button>
    </li>
  );
}

/**
 * Par etiqueta/valor. En dos columnas entran cuatro datos sin que la tarjeta
 * se estire de más.
 */
export function CampoTarjeta({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] uppercase tracking-wide text-muted">{etiqueta}</span>
      <span className="block truncate text-sm text-ink">{children}</span>
    </div>
  );
}

/** Grilla de campos dentro de una tarjeta. */
export function CamposTarjeta({ children }: { children: ReactNode }) {
  return <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>;
}
