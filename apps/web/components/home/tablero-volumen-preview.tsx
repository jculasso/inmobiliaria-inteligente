'use client';

import { useEffect, useState } from 'react';
import { etiquetaDeAlcance, type AlcanceModulo } from '../../lib/rbac';
import { fmtUSD } from '../../lib/format';
import { getAccessToken } from '../../lib/supabase/client';
import { getKpisResumen } from '../../lib/tablero-api';

/**
 * Volumen anual del Tablero para la card de la Home. Se pide client-side (no en
 * el SSR de la Home) para que la Home aparezca al instante: `getKpisResumen`
 * agrega todo el año y es más pesada que `getMe`, así que bloquear el render por
 * un stat opcional se sentía. Ahora se completa apenas resuelve (muestra "…").
 */
export function TableroVolumenPreview({ anio, alcance }: { anio: number; alcance: AlcanceModulo }) {
  const [volumen, setVolumen] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    getAccessToken()
      .then((token) => getKpisResumen(token, { anio }))
      .then((r) => {
        if (!cancelado) setVolumen(r.anual.volumen);
      })
      .catch(() => {
        /* stat opcional: si falla, queda el "…" en vez de romper la Home */
      });
    return () => {
      cancelado = true;
    };
  }, [anio]);

  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs">
      <span className="font-bold text-ink">{volumen === null ? '…' : fmtUSD(volumen)}</span>{' '}
      <span className="text-muted">volumen {anio}</span>
      <span className="ml-1 text-muted">· {etiquetaDeAlcance(alcance)}</span>
    </div>
  );
}
