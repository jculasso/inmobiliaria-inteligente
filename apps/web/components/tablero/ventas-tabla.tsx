'use client';

import type { AgregadoKpi } from '@vacker/types';
import { fmtNum, fmtUSD } from '../../lib/format';
import { PeriodosTabla, type FilaPeriodos } from './periodos-tabla';

/**
 * El cuadro de ventas por período, con las mismas filas que la planilla que
 * Vacker venía llevando a mano. Sirve para los trimestres y para los meses.
 *
 * Va DEBAJO del gráfico y no adentro. El gráfico tiene dos series —volumen y
 * comisión— y sirve para ver la tendencia de un vistazo; meterle las nueve
 * filas lo volvería ilegible. La tabla, en cambio, se lee sin interpretar.
 *
 * El orden de las filas es el de la planilla, a propósito: quien la venía
 * mirando en Excel encuentra cada número donde lo busca.
 */

const FILAS: {
  label: string;
  valor: (a: AgregadoKpi) => number;
  formato: (n: number) => string;
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

/**
 * El total de la fila.
 *
 * El ticket promedio NO se suma: es un promedio, y sumar los períodos daría el
 * ticket de nadie. Se recalcula sobre los totales del año, que es también como
 * lo hace `sumarAgregados`.
 */
function totalDe(fila: (typeof FILAS)[number], datos: AgregadoKpi[]): number {
  if (fila.label === 'Ticket prom.') {
    const volumen = datos.reduce((s, d) => s + d.volumen, 0);
    const puntas = datos.reduce((s, d) => s + d.puntas, 0);
    return puntas > 0 ? volumen / puntas : 0;
  }
  return datos.reduce((s, d) => s + fila.valor(d), 0);
}

export function VentasTabla({
  datos,
  etiquetas,
  seleccionado,
  onSelect,
}: {
  /** Un agregado por período, en el orden de `etiquetas`. */
  datos: AgregadoKpi[];
  etiquetas: string[];
  seleccionado: number;
  onSelect?: (periodo: number) => void;
}) {
  const filas: FilaPeriodos[] = FILAS.map((f) => ({
    label: f.label,
    valores: datos.map(f.valor),
    total: totalDe(f, datos),
    formato: f.formato,
    separa: f.separa,
    destaca: f.destaca,
  }));
  return (
    <PeriodosTabla
      titulo="Ventas por período"
      etiquetas={etiquetas}
      filas={filas}
      seleccionado={seleccionado}
      onSelect={onSelect}
      // Las dos clases escritas enteras: Tailwind solo genera las que ve
      // literales en el código.
      anchoMinimo={etiquetas.length > 6 ? 'min-w-[68rem]' : 'min-w-[38rem]'}
    />
  );
}
