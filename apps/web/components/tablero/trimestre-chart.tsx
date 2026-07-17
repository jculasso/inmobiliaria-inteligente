'use client';

import type { AgregadoKpi } from '@vacker/types';
import { fmtK } from '../../lib/format';

/** Redondea hacia arriba al próximo número "lindo" para el techo del eje. */
function nextNiceMax(n: number): number {
  if (n <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / step) * step;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Barras (Volumen USD) + línea (Comisión USD) por trimestre, con doble eje —
 * réplica del gráfico del prototipo (`chResTrim`). Clickeable: tocar una
 * barra selecciona ese trimestre.
 */
export function TrimestreChart({
  datos,
  seleccionado,
  onSelect,
}: {
  /** Agregados de los 4 trimestres, en orden Q1..Q4. */
  datos: AgregadoKpi[];
  seleccionado: number;
  onSelect: (trimestre: number) => void;
}) {
  const width = 720;
  const height = 220;
  const marginLeft = 56;
  const marginRight = 56;
  const plotWidth = width - marginLeft - marginRight;
  const barGap = 20;
  const barWidth = plotWidth / 4 - barGap;

  const volMax = nextNiceMax(Math.max(...datos.map((d) => d.volumen)));
  const comMax = nextNiceMax(Math.max(...datos.map((d) => d.comision)));

  const xFor = (i: number) => marginLeft + i * (barWidth + barGap);
  const yVol = (v: number) => height - (v / volMax) * (height - 10);
  const yCom = (v: number) => height - (v / comMax) * (height - 10);

  const linePoints = datos.map((d, i) => `${xFor(i) + barWidth / 2},${yCom(d.comision)}`).join(' ');

  return (
    <div className="rounded-brand border border-line bg-white p-4">
      <svg
        viewBox={`0 0 ${width} ${height + 26}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label="Volumen y comisión por trimestre"
      >
        {TICKS.map((t) => {
          const y = height - t * (height - 10);
          return (
            <g key={t}>
              <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} fontSize={10} textAnchor="end" fill="var(--color-ink)">
                {`$${fmtK(t * volMax)}`}
              </text>
              <text x={width - marginRight + 8} y={y + 4} fontSize={10} textAnchor="start" fill="var(--color-success)">
                {`$${fmtK(t * comMax)}`}
              </text>
            </g>
          );
        })}

        {datos.map((d, i) => {
          const x = xFor(i);
          const h = (d.volumen / volMax) * (height - 10);
          const y = yVol(d.volumen);
          const activo = seleccionado === i + 1;
          return (
            <g key={i} onClick={() => onSelect(i + 1)} className="cursor-pointer">
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
                fontSize={12}
                fontWeight={activo ? 700 : 500}
                fill={activo ? 'var(--color-brand-red)' : 'var(--color-ink)'}
              >
                {`Q${i + 1}`}
              </text>
            </g>
          );
        })}

        <polyline points={linePoints} fill="none" stroke="var(--color-success)" strokeWidth={2} />
        {datos.map((d, i) => (
          <circle
            key={`dot-${i}`}
            cx={xFor(i) + barWidth / 2}
            cy={yCom(d.comision)}
            r={5}
            fill="var(--color-success)"
            stroke="white"
            strokeWidth={2}
            className="cursor-pointer"
            onClick={() => onSelect(i + 1)}
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-red" aria-hidden />
            Volumen USD
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
            Comisión USD
          </span>
        </div>
        <span>tocá una barra o un trimestre</span>
      </div>
    </div>
  );
}
