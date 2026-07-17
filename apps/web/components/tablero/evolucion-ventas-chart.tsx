'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@vacker/ui';
import { fmtK, fmtUSD } from '../../lib/format';
import type { EvolucionMensualItem } from '../../lib/tablero-api';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Barras de volumen por mes del año seleccionado (una sola serie/eje, ver
 * skill de dataviz: nunca dos escalas en un mismo gráfico). Reemplaza al
 * gráfico dual-eje Volumen/Comisión del prototipo por dos motivos: evita la
 * dependencia de Chart.js y sigue la regla de "un solo eje" del design system.
 */
export function EvolucionVentasChart({
  anio,
  datos,
}: {
  anio: number;
  datos: EvolucionMensualItem[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...datos.map((d) => d.volumen), 1);
  const width = 720;
  const height = 180;
  const barGap = 6;
  const plotWidth = width - 40;
  const barWidth = plotWidth / datos.length - barGap;
  const gridValues = [max, max / 2, 0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución de ventas · {anio}</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full min-w-[520px]" role="img" aria-label={`Volumen mensual ${anio}`}>
          {gridValues.map((v) => {
            const y = height - (v / max) * (height - 12);
            return (
              <g key={v}>
                <line x1={40} y1={y} x2={width} y2={y} stroke="var(--color-line)" strokeWidth={1} />
                <text x={0} y={y + 4} fontSize={10} fill="var(--color-muted)">
                  {`$${fmtK(v)}`}
                </text>
              </g>
            );
          })}
          {datos.map((d, i) => {
            const h = max > 0 ? (d.volumen / max) * (height - 12) : 0;
            const x = 40 + i * (barWidth + barGap);
            const y = height - h;
            const activo = hover === i;
            return (
              <g
                key={d.mes}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(h, 1)}
                  rx={4}
                  fill={activo ? 'var(--color-brand-red-dark)' : 'var(--color-brand-red)'}
                />
                <text
                  x={x + barWidth / 2}
                  y={height + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--color-muted)"
                >
                  {MESES[d.mes - 1]}
                </text>
                {activo && (
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(y - 6, 10)}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="var(--color-ink)"
                  >
                    {fmtUSD(d.volumen)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}
