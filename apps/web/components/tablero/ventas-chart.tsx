'use client';

import type { AgregadoKpi } from '@vacker/types';
import { fmtK } from '../../lib/format';
import { periodosTranscurridos } from '../../lib/meses';
import { PeriodosChart } from './periodos-chart';

/**
 * Barras (Volumen USD) + línea (Comisión USD) por período, con doble eje —
 * réplica del gráfico del prototipo (`chResTrim`). Sirve para trimestres y
 * para meses. Clickeable: tocar una barra selecciona ese período.
 */
export function VentasChart({
  anio,
  datos,
  etiquetas,
  unidad,
  seleccionado,
  onSelect,
}: {
  /** Para no dibujar los períodos que todavía no llegaron. */
  anio: number;
  /** Un agregado por período, en el orden de `etiquetas`. */
  datos: AgregadoKpi[];
  etiquetas: string[];
  /** De qué son las barras, para la ayuda y para lectores de pantalla. */
  unidad: 'trimestre' | 'mes';
  seleccionado: number;
  onSelect: (periodo: number) => void;
}) {
  const plata = (n: number) => `$${fmtK(n)}`;
  return (
    <PeriodosChart
      titulo={`Volumen y comisión por ${unidad}`}
      etiquetas={etiquetas}
      barras={datos.map((d) => d.volumen)}
      linea={datos.map((d) => d.comision)}
      formatoBarras={plata}
      formatoLinea={plata}
      nombreBarras="Volumen USD"
      nombreLinea="Comisión USD"
      nombreLineaCorto="Comisión"
      seleccionado={seleccionado}
      onSelect={onSelect}
      pista={`tocá una barra o un ${unidad}`}
      transcurridos={periodosTranscurridos(anio, unidad)}
    />
  );
}
