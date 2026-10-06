'use client';

import { useEffect, useState } from 'react';
import { etiquetaDeAlcance, type AlcanceModulo } from '../../lib/rbac';
import { fmtUSD } from '../../lib/format';
import { getAccessToken } from '../../lib/supabase/client';
import { getKpisResumen } from '../../lib/tablero-api';
import { CLASE_FOCO } from '../piezas';

/**
 * Volumen anual del Tablero para la card de la Home. Se pide client-side (no en
 * el SSR de la Home) para que la Home aparezca al instante: `getKpisResumen`
 * agrega todo el año y es más pesada que `getMe`, así que bloquear el render por
 * un stat opcional se sentía. Ahora se completa apenas resuelve (muestra "…").
 *
 * Si falla (sin señal, la API dormida que no despertó a tiempo), muestra «—» y
 * un «Reintentar». Antes se quedaba en «…» para siempre: parecía que seguía
 * cargando y nadie sabía que tenía que recargar la página.
 */
export function TableroVolumenPreview({ anio, alcance }: { anio: number; alcance: AlcanceModulo }) {
  const [volumen, setVolumen] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);
  // Cambiarlo vuelve a correr el efecto: es el «Reintentar».
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setFallo(false);
    getAccessToken()
      // El alcance que dice la etiqueta y el que se pide tienen que ser el
      // mismo. Sin `verTodo`, el backend devuelve solo lo del usuario y la card
      // mostraba un número propio rotulado "Total" — una cifra que no era la
      // que el rótulo prometía.
      .then((token) => getKpisResumen(token, { anio, verTodo: alcance !== 'propio' }))
      .then((r) => {
        if (!cancelado) setVolumen(r.anual.volumen);
      })
      .catch(() => {
        // Stat opcional: si falla no rompe la Home, pero lo dice.
        if (!cancelado) setFallo(true);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, alcance, intento]);

  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs">
      <span className="font-bold text-ink">
        {volumen !== null ? fmtUSD(volumen) : fallo ? '—' : '…'}
      </span>{' '}
      <span className="text-muted">volumen {anio}</span>
      <span className="ml-1 text-muted">· {etiquetaDeAlcance(alcance)}</span>
      {fallo && volumen === null && (
        <button
          type="button"
          onClick={() => setIntento((n) => n + 1)}
          className={`ml-2 rounded font-semibold text-ink underline hover:no-underline ${CLASE_FOCO}`}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
