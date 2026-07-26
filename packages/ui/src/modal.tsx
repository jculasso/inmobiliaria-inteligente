'use client';

import { useEffect, type ReactNode } from 'react';

const ANCHOS = {
  md: 'sm:max-w-lg',
  // Formularios con varios campos en paralelo (ej. venta con puntas): permite
  // acomodarlos de a 2 por fila y reducir el scroll vertical.
  lg: 'sm:max-w-2xl',
  // Modales de detalle (tablas anchas de 6-8 columnas): necesitan más aire
  // horizontal que un formulario para no forzar scroll en cada fila.
  xl: 'sm:max-w-5xl',
} as const;

/**
 * Overlay modal de la plataforma.
 *
 * En el celular entra desde abajo y ocupa el ancho completo (patrón de hoja
 * inferior): el pulgar llega al encabezado y a los botones sin estirarse. Desde
 * `sm:` es una tarjeta centrada, como siempre.
 *
 * Mientras está abierto se bloquea el scroll del fondo. Sin eso, al llegar al
 * final del contenido el gesto seguía moviendo la página de atrás, que es parte
 * de la sensación de que la app "baila".
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  /** Bajada opcional bajo el título (período, contexto del detalle…). */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof ANCHOS;
}) {
  // Escape cierra: es lo que espera cualquiera que use teclado, y hasta ahora
  // la única salida era el botón o hacer clic afuera.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  // Fondo quieto mientras el modal está abierto.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[92dvh] w-full ${ANCHOS[size]} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-brand`}
      >
        {/* Filo de marca: el mismo recurso que usan las tarjetas de la Home. */}
        <div aria-hidden className="h-1 shrink-0 bg-brand-red" />

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold tracking-tight text-ink sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
