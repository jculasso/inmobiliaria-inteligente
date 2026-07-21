'use client';

import type { EstadoTasacion, ResumenTasadorKpi } from '@vacker/types';
import { ESTADO_TASACION_COLOR } from '@vacker/types';

interface Props {
  distribucion: ResumenTasadorKpi['distribucionEstado'];
  periodoLabel: string;
  onSelect?: (estado: EstadoTasacion) => void;
}

/** Barras proporcionales por estado, coloreadas — compartido entre Dashboard y Reporte. */
export function EstadoDistribucion({ distribucion, periodoLabel, onSelect }: Props) {
  const max = Math.max(...distribucion.map((d) => d.cantidad), 1);

  return (
    <div>
      <p className="mb-2 text-sm font-bold text-ink">
        Distribución por estado <span className="text-xs font-normal text-muted">({periodoLabel})</span>
      </p>
      <div className="flex flex-col gap-2">
        {distribucion.map((d) => {
          const fila = (
            <>
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: ESTADO_TASACION_COLOR[d.estado] }}
              />
              <span className="w-24 shrink-0 text-sm text-ink">{d.estado}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(d.cantidad / max) * 100}%`, background: ESTADO_TASACION_COLOR[d.estado] }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink">{d.cantidad}</span>
            </>
          );
          return onSelect ? (
            <button
              key={d.estado}
              type="button"
              onClick={() => onSelect(d.estado)}
              className="flex items-center gap-2 text-left"
            >
              {fila}
            </button>
          ) : (
            <div key={d.estado} className="flex items-center gap-2">
              {fila}
            </div>
          );
        })}
      </div>
    </div>
  );
}
