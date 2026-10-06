'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LiquidacionResumenDto, PendienteLiquidarDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarLiquidacionPdf } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';

const numero = (n: number) => String(n).padStart(6, '0');

/**
 * A quién hay que liquidar hoy, y las últimas liquidaciones (reglas 20 a 23).
 * Lo que espera a que pague el inquilino se muestra aparte: no es una deuda de
 * la inmobiliaria todavía.
 */
export function LiquidacionesBandeja({ pendientes, liquidaciones }: { pendientes: PendienteLiquidarDto[]; liquidaciones: LiquidacionResumenDto[] }) {
  const [error, setError] = useState<string | null>(null);
  const listos = pendientes.filter((p) => p.neto > 0);
  const soloEspera = pendientes.filter((p) => p.neto <= 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link href="/alquileres/liquidaciones/nueva">
          <Button variant="primary" size="sm">
            + Liquidar
          </Button>
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}

      <section className="rounded-brand border border-line bg-white">
        <h2 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Para liquidar · {listos.length}</h2>
        {listos.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Ningún propietario tiene alquileres cobrados sin liquidar.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {listos.map((p) => (
              <li key={`${p.persona.id}-${p.moneda}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{p.persona.nombre}</span>
                  {p.enEspera > 0 && <span className="block text-xs text-muted">Además espera {fmtMoneda(p.enEspera, p.moneda)} de inquilinos que no pagaron</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-bold tabular-nums text-ink">{fmtMoneda(p.neto, p.moneda)}</span>
                  <Link href={`/alquileres/liquidaciones/nueva?persona=${p.persona.id}`}>
                    <Button variant="secondary" size="sm">
                      Liquidar
                    </Button>
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        {soloEspera.length > 0 && (
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
            En espera, sin nada cobrado todavía: {soloEspera.map((p) => `${p.persona.nombre} (${fmtMoneda(p.enEspera, p.moneda)})`).join(', ')}.
          </p>
        )}
      </section>

      <section className="rounded-brand border border-line bg-white">
        <h2 className="border-b border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-muted">Últimas liquidaciones</h2>
        {liquidaciones.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Todavía no se liquidó a nadie.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {liquidaciones.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <Link href={`/alquileres/personas/${l.persona.id}`} className={`min-w-0 hover:underline ${l.anulado ? 'text-muted line-through' : 'text-ink'}`}>
                  <span className="font-semibold tabular-nums">{numero(l.numero)}</span> · {l.persona.nombre}
                  <span className="block text-xs text-muted">
                    {fmtFecha(l.fecha)}
                    {l.anulado ? ' · anulada' : ''}
                  </span>
                </Link>
                <span className="flex items-center gap-3">
                  <span className={`font-bold tabular-nums ${l.anulado ? 'text-muted line-through' : 'text-ink'}`}>{fmtMoneda(l.neto, l.moneda)}</span>
                  <button
                    type="button"
                    onClick={() => abrirPdfEnPestana(async () => generarLiquidacionPdf(await getAccessToken(), l.id), { titulo: `Liquidación ${numero(l.numero)}`, onError: setError })}
                    className="text-xs font-semibold text-brand-red hover:underline"
                  >
                    PDF
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
