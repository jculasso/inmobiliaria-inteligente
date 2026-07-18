'use client';

import type { ReactNode } from 'react';

const ANCHOS = {
  md: 'max-w-lg',
  // Modales de detalle (tablas anchas de 6-8 columnas): necesitan más aire
  // horizontal que un formulario para no forzar scroll en cada fila.
  xl: 'max-w-5xl',
} as const;

/** Overlay modal simple y accesible (no hay Dialog en @vacker/ui todavía). */
export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof ANCHOS;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`flex max-h-[90vh] w-full ${ANCHOS[size]} flex-col overflow-hidden rounded-brand bg-white shadow-lg`}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
