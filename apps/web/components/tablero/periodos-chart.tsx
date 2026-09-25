'use client';

/** Redondea hacia arriba al próximo número "lindo" para el techo del eje. */
function nextNiceMax(n: number): number {
  if (n <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / step) * step;
}

const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Barras + línea por período, con doble eje. Clickeable: tocar una barra
 * elige ese período.
 *
 * Nació como el gráfico trimestral de ventas —barras de volumen, línea de
 * comisión— y se generalizó el 25/09/2026 para los meses y para alquileres.
 * Vacker pidió alquileres «bajo el mismo esquema que el de ventas», así que el
 * esquema es este mismo: la magnitud principal en barras, la comisión en línea.
 */
export function PeriodosChart({
  etiquetas,
  barras,
  linea,
  formatoBarras,
  formatoLinea,
  nombreBarras,
  nombreLinea,
  nombreLineaCorto = nombreLinea,
  seleccionado,
  onSelect,
  pista,
  titulo,
  barrasEnteras = false,
}: {
  etiquetas: string[];
  barras: number[];
  linea: number[];
  formatoBarras: (n: number) => string;
  formatoLinea: (n: number) => string;
  /** Para la leyenda, p. ej. «Volumen USD». */
  nombreBarras: string;
  nombreLinea: string;
  /** Para las barras acostadas del celular, donde el «USD» sobra al lado del «$». */
  nombreLineaCorto?: string;
  /** 1..etiquetas.length */
  seleccionado: number;
  onSelect: (periodo: number) => void;
  /** La ayuda de abajo a la derecha, p. ej. «tocá una barra o un trimestre». */
  pista: string;
  titulo: string;
  /**
   * Las barras cuentan cosas enteras —alquileres, no dólares—. El eje se parte
   * en cuartos, y con un máximo de 9 las marcas caían en 2,25 y 6,75
   * alquileres: se lleva el techo a un múltiplo de 4 para que sean enteras.
   */
  barrasEnteras?: boolean;
}) {
  const n = etiquetas.length;
  const width = 720;
  const height = 220;
  const marginLeft = 56;
  const marginRight = 56;
  const plotWidth = width - marginLeft - marginRight;
  // Con doce barras el hueco de cuatro las dejaría finitas como palillos.
  const barGap = n > 6 ? 8 : 20;
  const barWidth = plotWidth / n - barGap;

  const barMax = barrasEnteras
    ? Math.max(4, Math.ceil(Math.max(...barras) / 4) * 4)
    : nextNiceMax(Math.max(...barras));
  const lineMax = nextNiceMax(Math.max(...linea));

  const xFor = (i: number) => marginLeft + i * (barWidth + barGap);
  const yBar = (v: number) => height - (v / barMax) * (height - 10);
  const yLine = (v: number) => height - (v / lineMax) * (height - 10);

  const linePoints = linea.map((v, i) => `${xFor(i) + barWidth / 2},${yLine(v)}`).join(' ');

  // El scroller queda solo para pantalla ancha: si el gráfico no entra en una
  // tablet angosta, se desliza ahí y no en el celular.
  return (
    <div className="rounded-brand border border-line bg-white p-4 sm:overflow-x-auto sm:overscroll-x-contain">
      {/* En el celular el gráfico no entra: a 360px se salía 226px y había que
          deslizarlo de costado. Las mismas barras, acostadas, entran enteras y
          se leen sin mover nada. */}
      <ul aria-label={titulo} className={`flex flex-col ${n > 6 ? 'gap-1' : 'gap-2'} sm:hidden`}>
        {barras.map((v, i) => {
          const activo = seleccionado === i + 1;
          const marco = activo ? 'border-brand-red/40 bg-brand-red/5' : 'border-line bg-white';
          return (
            <li key={i}>
              {n > 6 ? (
                /*
                 * Con doce períodos, un renglón por barra. En tres renglones
                 * —etiqueta, barra, comisión— los doce meses ocupaban una pantalla
                 * entera antes de llegar a la tabla, que repite los mismos doce
                 * números. La altura mínima es 44px, lo que pide iOS para tocar.
                 */
                <button
                  type="button"
                  onClick={() => onSelect(i + 1)}
                  className={`grid min-h-11 w-full grid-cols-[2.25rem_1fr_auto] items-center gap-2 rounded-lg border px-2.5 text-left ${marco}`}
                >
                  <span className={`text-xs font-extrabold ${activo ? 'text-brand-red' : 'text-ink'}`}>{etiquetas[i]}</span>
                  <span className="block h-2 overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-brand-red" style={{ width: `${(v / barMax) * 100}%` }} />
                  </span>
                  <span className="text-right text-xs font-bold tabular-nums text-ink">
                    {formatoBarras(v)}{' '}
                    <span className="font-semibold text-success">{formatoLinea(linea[i]!)}</span>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(i + 1)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left ${marco}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`text-xs font-extrabold ${activo ? 'text-brand-red' : 'text-ink'}`}>
                      {etiquetas[i]}
                    </span>
                    <span className="text-xs font-bold text-ink">{formatoBarras(v)}</span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-brand-red" style={{ width: `${(v / barMax) * 100}%` }} />
                  </span>
                  <span className="mt-1 block text-[11px] text-success">{`${nombreLineaCorto} ${formatoLinea(linea[i]!)}`}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <svg
        viewBox={`0 0 ${width} ${height + 26}`}
        className="hidden w-full min-w-[520px] sm:block"
        role="img"
        aria-label={titulo}
      >
        {TICKS.map((t) => {
          const y = height - t * (height - 10);
          return (
            <g key={t}>
              <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={marginLeft - 8} y={y + 4} fontSize={10} textAnchor="end" fill="var(--color-ink)">
                {formatoBarras(t * barMax)}
              </text>
              <text x={width - marginRight + 8} y={y + 4} fontSize={10} textAnchor="start" fill="var(--color-success)">
                {formatoLinea(t * lineMax)}
              </text>
            </g>
          );
        })}

        {barras.map((v, i) => {
          const x = xFor(i);
          const h = (v / barMax) * (height - 10);
          const activo = seleccionado === i + 1;
          return (
            <g key={i} onClick={() => onSelect(i + 1)} className="cursor-pointer">
              <rect
                x={x}
                y={yBar(v)}
                width={barWidth}
                height={Math.max(h, 1)}
                rx={n > 6 ? 2 : 4}
                fill={activo ? 'var(--color-brand-red-dark)' : 'var(--color-brand-red)'}
              />
              <text
                x={x + barWidth / 2}
                y={height + 18}
                textAnchor="middle"
                fontSize={n > 6 ? 11 : 12}
                fontWeight={activo ? 700 : 500}
                fill={activo ? 'var(--color-brand-red)' : 'var(--color-ink)'}
              >
                {etiquetas[i]}
              </text>
            </g>
          );
        })}

        <polyline points={linePoints} fill="none" stroke="var(--color-success)" strokeWidth={2} />
        {linea.map((v, i) => (
          <circle
            key={`dot-${i}`}
            cx={xFor(i) + barWidth / 2}
            cy={yLine(v)}
            r={n > 6 ? 4 : 5}
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
            {nombreBarras}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
            {nombreLinea}
          </span>
        </div>
        <span>{pista}</span>
      </div>
    </div>
  );
}
