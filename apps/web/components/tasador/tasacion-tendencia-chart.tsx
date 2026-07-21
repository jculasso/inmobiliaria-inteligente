'use client';

/** Redondea hacia arriba al próximo número "lindo" para el techo del eje. */
function nextNiceMax(n: number): number {
  if (n <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / step) * step;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1];

export interface TendenciaBar {
  label: string;
  total: number;
}

/**
 * Gráfico de barras de 1 sola serie (cantidad de tasaciones) con eje de
 * tiempo variable (12 meses / 4 trimestres / 1 año, según la vista elegida
 * en el dashboard). No reusa `TrimestreChart` de Tablero: ese componente
 * está atado a 2 series con doble eje y exactamente 4 columnas.
 */
export function TasacionTendenciaChart({
  datos,
  seleccionado,
  onSelect,
}: {
  datos: TendenciaBar[];
  seleccionado: number;
  onSelect: (indice: number) => void;
}) {
  const width = 720;
  const height = 200;
  const marginLeft = 40;
  const marginRight = 16;
  const plotWidth = width - marginLeft - marginRight;
  const barGap = Math.min(20, plotWidth / datos.length / 4);
  const barWidth = plotWidth / datos.length - barGap;

  const max = nextNiceMax(Math.max(...datos.map((d) => d.total), 1));
  const xFor = (i: number) => marginLeft + i * (barWidth + barGap);
  const yFor = (v: number) => height - (v / max) * (height - 10);

  return (
    <div className="rounded-brand border border-line bg-white p-4">
      <svg
        viewBox={`0 0 ${width} ${height + 26}`}
        className="w-full min-w-[420px]"
        role="img"
        aria-label="Cantidad de tasaciones por período"
      >
        {TICKS.map((t) => {
          const y = height - t * (height - 10);
          return (
            <g key={t}>
              <line
                x1={marginLeft}
                y1={y}
                x2={width - marginRight}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text x={marginLeft - 6} y={y + 4} fontSize={10} textAnchor="end" fill="var(--color-muted)">
                {Math.round(t * max)}
              </text>
            </g>
          );
        })}

        {datos.map((d, i) => {
          const x = xFor(i);
          const h = (d.total / max) * (height - 10);
          const y = yFor(d.total);
          const activo = seleccionado === i;
          return (
            <g key={i} onClick={() => onSelect(i)} className="cursor-pointer">
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
                y={height + 18}
                textAnchor="middle"
                fontSize={11}
                fontWeight={activo ? 700 : 500}
                fill={activo ? 'var(--color-brand-red)' : 'var(--color-ink)'}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
