'use client';

import type { MonedaAlquiler } from '@vacker/types';
import { Modal } from '@vacker/ui';
import { fmtMoneda } from '../../../lib/format';
import { NOMBRES_MES } from '../../../lib/meses';
import { CLASE_FOCO, CLASE_TH } from '../piezas';
import { pct, suma } from './formatos';

/** Un mes de «Cobrado dentro del mes»: lo emitido y lo cobrado hasta su último día. */
export interface MesCobrado {
  /** `AAAA-MM`. */
  mes: string;
  emitido: number;
  alCierre: number;
}

const nombreDe = (mes: string) => NOMBRES_MES[Number(mes.slice(5, 7)) - 1]!;

/**
 * Regla 188: la cuenta de «Cobrado dentro del mes», mes por mes, con un
 * total cuyo porcentaje se recalcula sobre los totales (regla 76) y es el de
 * la tarjeta. Sale de lo que ya viaja con el tablero: abre al instante. Tocar
 * un mes abre sus alquileres emitidos.
 */
export function CobradoPorMesModal({
  titulo,
  moneda,
  meses,
  mesEnCurso,
  elegirMes,
  onClose,
}: {
  titulo: string;
  moneda: MonedaAlquiler;
  meses: MesCobrado[];
  /** El mes de hoy, `AAAA-MM`: su cierre todavía no llegó. */
  mesEnCurso: string;
  elegirMes: (mes: string) => void;
  onClose: () => void;
}) {
  const emitido = suma(meses.map((m) => m.emitido));
  const alCierre = suma(meses.map((m) => m.alCierre));
  const plata = (n: number) => fmtMoneda(n, moneda);
  const enCurso = (mes: string) =>
    mes === mesEnCurso && <span className="text-xs font-normal text-muted"> · en curso</span>;
  return (
    <Modal
      title={titulo}
      subtitle="Lo cobrado hasta el último día de cada mes, sobre lo emitido · tocá un mes para ver sus alquileres"
      onClose={onClose}
      size="lg"
    >
      {meses.length === 0 ? (
        <p className="text-sm text-muted">No hay alquileres emitidos en este período.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* En el teléfono, un mes por tarjeta: los importes exactos no entran en cuatro columnas. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {meses.map((m) => (
              <li key={m.mes}>
                <button
                  type="button"
                  onClick={() => elegirMes(m.mes)}
                  className={`block w-full rounded-brand border border-line p-3 text-left text-sm hover:bg-surface/60 ${CLASE_FOCO}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-ink">
                      {nombreDe(m.mes)}
                      {enCurso(m.mes)}
                    </span>
                    <span className="font-extrabold tabular-nums text-ink">
                      {pct(m.alCierre, m.emitido)}
                    </span>
                  </span>
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted">Emitido</dt>
                      <dd className="tabular-nums text-ink">{plata(m.emitido)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted">Cobrado dentro del mes</dt>
                      <dd className="font-semibold tabular-nums text-ink">{plata(m.alCierre)}</dd>
                    </div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={CLASE_TH}>Mes</th>
                  <th className={`${CLASE_TH} text-right`}>Emitido</th>
                  <th className={`${CLASE_TH} text-right`}>Cobrado dentro del mes</th>
                  <th className={`${CLASE_TH} text-right`}>%</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr
                    key={m.mes}
                    onClick={() => elegirMes(m.mes)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-3 py-2 font-semibold text-ink">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          elegirMes(m.mes);
                        }}
                        className={`rounded-md text-left hover:text-brand-red ${CLASE_FOCO}`}
                      >
                        {nombreDe(m.mes)}
                      </button>
                      {enCurso(m.mes)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted">
                      {plata(m.emitido)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink">
                      {plata(m.alCierre)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink">
                      {pct(m.alCierre, m.emitido)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-bold text-ink">
                  <td className="px-3 py-2">Total</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {plata(emitido)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {plata(alCierre)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {pct(alCierre, emitido)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Regla 76: el porcentaje del total se recalcula sobre los totales, nunca el promedio. */}
          <dl
            aria-label="Total"
            className="flex flex-col gap-1 border-t border-line pt-3 text-sm sm:hidden"
          >
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-bold text-ink">Total</dt>
              <dd className="font-extrabold tabular-nums text-ink">{pct(alCierre, emitido)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-muted">Emitido</dt>
              <dd className="ml-auto tabular-nums text-ink">{plata(emitido)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <dt className="text-muted">Cobrado dentro del mes</dt>
              <dd className="ml-auto font-semibold tabular-nums text-ink">{plata(alCierre)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}
