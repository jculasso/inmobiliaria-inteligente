'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LIMITE_LISTA, recortarAlLimite, type CobroResumenDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { generarRecibo } from '../../lib/alquileres-api';
import { abrirPdfEnPestana } from '../../lib/abrir-pdf';
import { fmtFecha, fmtMoneda } from '../../lib/format';

const recibo = (n: number) => String(n).padStart(6, '0');
const MEDIO = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro' } as const;

/** Los últimos cobros, con su recibo. Cada uno lleva a la cuenta de quien pagó. */
export function CobrosLista({ cobros }: { cobros: CobroResumenDto[] }) {
  const [error, setError] = useState<string | null>(null);
  const { visibles, hayMas } = recortarAlLimite(cobros);
  const descargar = (c: CobroResumenDto) =>
    abrirPdfEnPestana(async () => generarRecibo(await getAccessToken(), c.id), { titulo: `Recibo ${recibo(c.numero)}`, onError: setError });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Link href="/alquileres/cobros/nuevo">
          <Button variant="primary" size="sm">
            + Nuevo cobro
          </Button>
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brand-red">
          {error}
        </p>
      )}
      {hayMas && <p className="text-sm text-muted">Se muestran los últimos {LIMITE_LISTA} cobros.</p>}
      {cobros.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">Todavía no se registró ningún cobro.</p>
      ) : (
        <ul className="divide-y divide-line rounded-brand border border-line bg-white text-sm">
          {visibles.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link href={`/alquileres/personas/${c.persona.id}`} className={`min-w-0 hover:underline ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}>
                <span className="font-semibold tabular-nums">{recibo(c.numero)}</span> · {c.persona.nombre}
                <span className="block text-xs text-muted no-underline">
                  {fmtFecha(c.fecha)} · {MEDIO[c.medio]}
                  {c.anulado ? ' · anulado' : ''}
                </span>
              </Link>
              <span className="flex items-center gap-3">
                <span className={`font-bold tabular-nums ${c.anulado ? 'text-muted line-through' : 'text-ink'}`}>{fmtMoneda(c.importe, c.moneda)}</span>
                <button type="button" onClick={() => descargar(c)} className="text-xs font-semibold text-brand-red hover:underline">
                  Recibo
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
