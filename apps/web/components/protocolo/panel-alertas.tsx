'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AlertaProtocolo } from '@vacker/types';
import { AlertaItem } from './protocolo-ui';

export interface AlertaConPropiedad extends AlertaProtocolo {
  protocoloId: string;
  direccion: string;
}

/**
 * Alertas del dashboard, colapsables. Arranca cerrado mostrando el conteo por
 * urgencia: la lista completa empuja las propiedades fuera de la pantalla, y
 * el dato que importa de un vistazo es cuántas hay y de qué color.
 */
export function PanelAlertas({ alertas }: { alertas: AlertaConPropiedad[] }) {
  const [abierto, setAbierto] = useState(false);

  const rojas = alertas.filter((a) => a.nivel === 'roja').length;
  const ambares = alertas.filter((a) => a.nivel === 'ambar').length;
  const sinAlertas = alertas.length === 0;

  return (
    <section className="rounded-brand border border-line bg-white">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="text-lg">
            {sinAlertas ? '✅' : rojas > 0 ? '🔴' : '🟠'}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              {sinAlertas
                ? 'Todo al día'
                : `${alertas.length} ${alertas.length === 1 ? 'alerta' : 'alertas'}`}
            </span>
            <span className="block text-xs text-muted">
              {sinAlertas
                ? 'No hay pendientes en las propiedades activas.'
                : [rojas > 0 ? `${rojas} urgente${rojas === 1 ? '' : 's'}` : null,
                   ambares > 0 ? `${ambares} para revisar` : null]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
          </span>
        </span>

        {!sinAlertas && (
          <span className="flex shrink-0 items-center gap-2">
            {rojas > 0 && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-extrabold text-danger">
                {rojas}
              </span>
            )}
            {ambares > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-extrabold text-warning">
                {ambares}
              </span>
            )}
            <span aria-hidden className={`text-muted transition-transform ${abierto ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </span>
        )}
      </button>

      {abierto && !sinAlertas && (
        <div className="flex flex-col gap-2 border-t border-line p-3">
          {alertas.map((a, i) => (
            <Link
              key={`${a.protocoloId}-${i}`}
              href={
                a.semana != null
                  ? `/protocolo/${a.protocoloId}?semana=${a.semana}`
                  : `/protocolo/${a.protocoloId}`
              }
            >
              <AlertaItem alerta={{ ...a, titulo: `${a.direccion} · ${a.titulo}` }} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
