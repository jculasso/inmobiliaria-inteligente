import type { ReactNode } from 'react';

/**
 * Piezas para las páginas de documentación del panel (guía, onboarding,
 * inversión). Mismo lenguaje visual que el resto: etiqueta chica en mayúscula,
 * títulos con peso y bloques en tarjeta.
 */

export function DocHeader({ titulo, bajada }: { titulo: string; bajada: string }) {
  return (
    <header className="border-b border-line pb-4">
      <h2 className="text-2xl font-extrabold tracking-tight text-ink">{titulo}</h2>
      <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{bajada}</p>
    </header>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-brand-red">{titulo}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Paso numerado de un procedimiento. */
export function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-brand border border-line bg-white p-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-red text-[11px] font-extrabold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{titulo}</p>
        <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}

/** Aviso que corta la lectura. `tono` cambia el color, no el tamaño. */
export function Aviso({
  tono = 'atencion',
  titulo,
  children,
}: {
  tono?: 'atencion' | 'peligro' | 'ok';
  titulo: string;
  children: ReactNode;
}) {
  const estilos = {
    atencion: 'border-l-amber-500 bg-amber-50',
    peligro: 'border-l-brand-red bg-brand-red/5',
    ok: 'border-l-success bg-success/5',
  }[tono];

  return (
    <div className={`rounded-brand border border-line border-l-[3px] p-4 ${estilos}`}>
      <p className="text-sm font-bold text-ink">{titulo}</p>
      <div className="mt-1 flex flex-col gap-2 text-sm leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}

export function Tarjeta({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="rounded-brand border border-line bg-white p-4">
      {titulo && <p className="mb-2 text-sm font-bold text-ink">{titulo}</p>}
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Dato duro con su unidad, para las tablas de inversión. */
export function Cifra({ valor, unidad }: { valor: string; unidad?: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-base font-extrabold text-ink">{valor}</span>
      {unidad && <span className="ml-1 text-xs text-muted">{unidad}</span>}
    </span>
  );
}
