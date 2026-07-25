'use client';

import { useState } from 'react';
import type { CandidataDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';
import { FotoPropiedad, Pill } from './protocolo-ui';
import { IniciarProtocoloModal } from './iniciar-protocolo-modal';

/**
 * Tasaciones captadas todavía sin protocolo: la bandeja de entrada del módulo.
 * Cada una arranca su comercialización con el botón de la derecha.
 */
export function CaptadasLista({ captadas }: { captadas: CandidataDto[] }) {
  const [elegida, setElegida] = useState<CandidataDto | null>(null);

  if (captadas.length === 0) {
    return (
      <div className="rounded-brand border border-dashed border-line bg-white px-6 py-12 text-center">
        <p className="text-3xl" aria-hidden>
          ✅
        </p>
        <h3 className="mt-2 text-base font-bold text-ink">No hay captaciones pendientes</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Todas las tasaciones captadas ya tienen su protocolo iniciado. Las nuevas captaciones aparecen acá
          automáticamente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {captadas.map((c) => (
          <article
            key={c.tasacionId}
            className="flex flex-col gap-3 rounded-brand border border-line bg-white p-3 sm:flex-row sm:items-center"
          >
            <FotoPropiedad
              url={c.fotoUrl}
              alt={c.direccion}
              className="h-24 w-full shrink-0 rounded-brand sm:h-16 sm:w-24"
            />

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold leading-snug text-ink">{c.direccion}</h3>
              <p className="text-xs text-muted">
                {c.tipoPropiedad} · {[c.barrio, c.ciudad].filter(Boolean).join(', ') || 'Sin ubicación'}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Pill>{c.cliente}</Pill>
                <Pill>{c.agente.nombre}</Pill>
                {c.diasExclusividad != null && <Pill tono="ambar">Exclusiva {c.diasExclusividad} días</Pill>}
                {c.codigo && <Pill>{c.codigo}</Pill>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
              <span className="text-sm font-bold text-ink">
                {c.valorRecomendado != null ? fmtUSD(c.valorRecomendado) : 'Sin valor'}
              </span>
              <Button variant="primary" size="sm" onClick={() => setElegida(c)}>
                Iniciar protocolo
              </Button>
            </div>
          </article>
        ))}
      </div>

      {elegida && <IniciarProtocoloModal candidata={elegida} onClose={() => setElegida(null)} />}
    </>
  );
}
