'use client';

import { useRouter } from 'next/navigation';
import type { TasacionResumenDto } from '@vacker/types';
import { fmtUSD } from '../../lib/format';
import { detalleEstado, estadoClass } from '../../lib/tasacion-estado';
import { ConfirmDeleteButton } from '../tablero/confirm-delete-button';

interface Props {
  tasacion: TasacionResumenDto;
  /** Click en el badge de estado (abre el modal de cambio de estado). */
  onEstado: () => void;
  /** Generar/ver el informe PDF. */
  onVer: () => void;
  /** Muestra el spinner "Generando…" en el botón Ver. */
  generando?: boolean;
  /** Si viene, se muestra el botón de borrar (vista de gestión / historial). */
  onBorrar?: () => Promise<void>;
}

/**
 * Fila de tasación compartida entre el dashboard ("últimas tasaciones") y el
 * historial, para que ambas vistas se vean igual y no se desincronicen.
 */
export function TasacionFila({ tasacion: t, onEstado, onVer, generando, onBorrar }: Props) {
  const router = useRouter();
  const det = detalleEstado(t);

  return (
    <div className="grid grid-cols-1 gap-2 border-t border-surface py-3 first:border-t-0 sm:grid-cols-[2fr_1fr_130px_auto] sm:items-center sm:gap-3.5">
      <div>
        <div className="text-sm font-bold text-ink">{t.direccion}</div>
        <div className="mt-0.5 text-xs text-muted">
          {t.cliente} · {t.tipoPropiedad} · {t.agente.nombre}
        </div>
      </div>
      <div className="text-sm font-bold text-brand-red">{fmtUSD(t.valorRecomendado)}</div>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onEstado}
          className={`w-full rounded-full px-2 py-1 text-center text-xs font-bold ${estadoClass(t.estado)}`}
        >
          {t.estado}
        </button>
        {det && (
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${estadoClass(t.estado)}`}>{det}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => router.push(`/tasador/tasaciones/${t.id}/editar`)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand-red hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onVer}
          disabled={generando}
          aria-busy={generando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-brand-red hover:text-brand-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 disabled:cursor-progress disabled:opacity-70"
        >
          {generando ? (
            <>
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border-2 border-brand-red border-t-transparent"
              />
              Generando…
            </>
          ) : (
            'Ver'
          )}
        </button>
        {onBorrar && (
          <ConfirmDeleteButton confirmMessage={`¿Borrar la tasación de ${t.cliente}?`} onConfirm={onBorrar} />
        )}
      </div>
    </div>
  );
}
