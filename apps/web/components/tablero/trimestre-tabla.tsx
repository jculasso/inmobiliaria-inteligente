'use client';

import type { AgregadoKpi } from '@vacker/types';
import { fmtNum, fmtUSD } from '../../lib/format';

/**
 * El cuadro de ventas por trimestre, con las mismas filas que la planilla que
 * Vacker venía llevando a mano.
 *
 * Va DEBAJO del gráfico y no adentro. El gráfico tiene dos series —volumen y
 * comisión— y sirve para ver la tendencia de un vistazo; meterle las nueve
 * filas lo volvería ilegible. La tabla, en cambio, se lee sin interpretar.
 *
 * El orden de las filas es el de la planilla, a propósito: quien la venía
 * mirando en Excel encuentra cada número donde lo busca.
 *
 * En el celular NO se convierte en tarjetas, que es lo que hace el resto de las
 * tablas del tablero. Acá lo que se quiere comparar es un trimestre contra otro,
 * y en tarjetas separadas esa comparación se pierde. Se desplaza de costado con
 * la columna de métricas fija, que es como se lee una planilla en el teléfono.
 */

/** Una fila del cuadro: cómo sacar el número de un trimestre y cómo mostrarlo. */
const FILAS: {
  label: string;
  valor: (a: AgregadoKpi) => number;
  formato: (n: number) => string;
  /** Las que separan bloques llevan una línea arriba. */
  separa?: boolean;
  destaca?: boolean;
}[] = [
  { label: 'Volumen USD', valor: (a) => a.volumen, formato: fmtUSD },
  { label: 'Operaciones', valor: (a) => a.operaciones, formato: fmtNum },
  { label: 'Ticket prom.', valor: (a) => a.ticketPromedio, formato: fmtUSD },
  { label: 'Puntas', valor: (a) => a.puntas, formato: fmtNum, separa: true },
  { label: 'P. compradoras', valor: (a) => a.puntasCompradoras, formato: fmtNum },
  { label: 'P. vendedoras', valor: (a) => a.puntasVendedoras, formato: fmtNum },
  { label: 'Com. comprador', valor: (a) => a.comisionCompradora, formato: fmtUSD, separa: true },
  { label: 'Com. vendedor', valor: (a) => a.comisionVendedora, formato: fmtUSD },
  { label: 'Total comisión', valor: (a) => a.comision, formato: fmtUSD, destaca: true },
];

const TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * El total de la fila.
 *
 * El ticket promedio NO se suma: es un promedio, y sumar los cuatro trimestres
 * daría el ticket de nadie. Se recalcula sobre los totales del año, que es
 * también como lo hace `sumarAgregados`.
 */
function totalDe(fila: (typeof FILAS)[number], datos: AgregadoKpi[]): number {
  if (fila.label === 'Ticket prom.') {
    const volumen = datos.reduce((s, d) => s + d.volumen, 0);
    const puntas = datos.reduce((s, d) => s + d.puntas, 0);
    return puntas > 0 ? volumen / puntas : 0;
  }
  return datos.reduce((s, d) => s + fila.valor(d), 0);
}

export function TrimestreTabla({
  datos,
  seleccionado,
  onSelect,
}: {
  /** Los cuatro trimestres, en orden. */
  datos: AgregadoKpi[];
  seleccionado: number;
  onSelect?: (trimestre: number) => void;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[38rem] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted [&>th]:border-b [&>th]:border-line">
            {/* Fija: al desplazar de costado hay que seguir sabiendo qué fila
                se está mirando. */}
            <th className="sticky left-0 z-10 bg-white px-4 py-2">Métrica</th>
            {TRIMESTRES.map((q, i) => (
              <th
                key={q}
                aria-current={seleccionado === i + 1 ? 'true' : undefined}
                className={`px-4 py-2 text-right ${seleccionado === i + 1 ? 'text-brand-red' : ''}`}
              >
                {onSelect ? (
                  <button type="button" onClick={() => onSelect(i + 1)} className="hover:underline">
                    {q}
                  </button>
                ) : (
                  q
                )}
              </th>
            ))}
            <th className="px-4 py-2 text-right text-ink">Total</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.map((fila) => (
            <tr
              key={fila.label}
              className={`${fila.separa ? 'border-t border-line' : ''} ${
                fila.destaca ? 'font-bold text-ink' : ''
              }`}
            >
              <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-muted">{fila.label}</td>
              {datos.map((d, i) => (
                <td
                  key={i}
                  className={`px-4 py-1.5 text-right tabular-nums ${
                    seleccionado === i + 1 ? 'bg-brand-red/5 font-semibold text-ink' : ''
                  }`}
                >
                  {fila.formato(fila.valor(d))}
                </td>
              ))}
              <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-ink">
                {fila.formato(totalDe(fila, datos))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
