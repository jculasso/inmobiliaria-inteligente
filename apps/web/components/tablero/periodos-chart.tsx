'use client';

import { marcasDelEje } from '../../lib/eje';

/**
 * Dos magnitudes por período —volumen y comisión, o alquileres y comisión—, en
 * DOS paneles alineados: cada mes ocupa la misma columna en los dos, y cada
 * panel tiene su propia escala. Clickeable: tocar una barra elige ese período.
 *
 * POR QUÉ DOS PANELES Y NO BARRAS CON UNA LÍNEA ENCIMA. Hasta el 5/10/2026 era
 * un gráfico de doble eje: el volumen en barras y la comisión en una línea
 * superpuesta, con su escala a la derecha. Se corrigieron las marcas del eje,
 * el color de la línea y los meses futuros, y seguía viéndose mal — porque el
 * problema era el formato. Con dos escalas en el mismo espacio, la línea no
 * tiene ninguna relación visual con las barras: septiembre era la barra más
 * alta con el punto a media altura, agosto tenía el punto por encima de su
 * barra, y quien lo mira lee una contradicción que no existe. Separados, cada
 * barra se lee contra su propio eje y la comparación entre meses se hace en
 * vertical, columna por columna.
 *
 * Nació como el gráfico trimestral de ventas y se generalizó el 25/09/2026 para
 * los meses y para alquileres, que Vacker pidió «bajo el mismo esquema que el
 * de ventas».
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
  transcurridos,
}: {
  etiquetas: string[];
  /** El panel de arriba: la magnitud principal (volumen, alquileres firmados). */
  barras: number[];
  /** El panel de abajo: la comisión. Se llamaba línea y el nombre quedó. */
  linea: number[];
  formatoBarras: (n: number) => string;
  formatoLinea: (n: number) => string;
  /** El título de cada panel, p. ej. «Volumen USD». */
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
  /** El panel de arriba cuenta cosas enteras —alquileres, no dólares—: marcas enteras. */
  barrasEnteras?: boolean;
  /**
   * Cuántos períodos ya empezaron (ver `periodosTranscurridos`). Los que vienen
   * no llevan barra: valen «todavía no», no cero. Sin el dato se dibujan todos.
   */
  transcurridos?: number;
}) {
  const n = etiquetas.length;
  const width = 720;
  const marginLeft = 56;
  const marginRight = 12;
  const plotWidth = width - marginLeft - marginRight;
  // Con doce barras el hueco de cuatro las dejaría finitas como palillos.
  const barGap = n > 6 ? 8 : 20;
  const barWidth = (plotWidth - barGap * (n - 1)) / n;
  const xFor = (i: number) => marginLeft + i * (barWidth + barGap);
  const hasta = Math.min(transcurridos ?? n, n);

  // El de arriba más alto: es la magnitud principal. El de abajo alcanza para
  // ver la forma de la comisión mes a mes.
  const paneles = [
    {
      clave: 'barras',
      nombre: nombreBarras,
      valores: barras,
      formato: formatoBarras,
      eje: marcasDelEje(Math.max(...barras), barrasEnteras),
      top: 26,
      alto: 140,
    },
    {
      clave: 'linea',
      nombre: nombreLinea,
      valores: linea,
      formato: formatoLinea,
      eje: marcasDelEje(Math.max(...linea), false, 3),
      top: 210,
      alto: 84,
    },
  ];
  /** El largo de las barras acostadas del celular, contra el mismo techo. */
  const barMax = paneles[0]!.eje.techo;
  const yEtiquetas = 294 + 20;
  const height = yEtiquetas + 8;

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
                  <span
                    className={`text-xs font-extrabold ${activo ? 'text-brand-red' : 'text-ink'}`}
                  >
                    {etiquetas[i]}
                  </span>
                  <span className="block h-2 overflow-hidden rounded-full bg-surface">
                    <span
                      className="block h-full rounded-full bg-brand-red"
                      style={{ width: `${(v / barMax) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-xs font-bold tabular-nums text-ink">
                    {formatoBarras(v)}{' '}
                    <span className="font-semibold text-muted">{formatoLinea(linea[i]!)}</span>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(i + 1)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left ${marco}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-xs font-extrabold ${activo ? 'text-brand-red' : 'text-ink'}`}
                    >
                      {etiquetas[i]}
                    </span>
                    <span className="text-xs font-bold text-ink">{formatoBarras(v)}</span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface">
                    <span
                      className="block h-full rounded-full bg-brand-red"
                      style={{ width: `${(v / barMax) * 100}%` }}
                    />
                  </span>
                  <span className="mt-1 block text-[11px] text-muted">{`${nombreLineaCorto} ${formatoLinea(linea[i]!)}`}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="hidden w-full min-w-[520px] sm:block"
        role="img"
        aria-label={titulo}
      >
        {paneles.map((p) => {
          const y = (v: number) => p.top + p.alto - (v / p.eje.techo) * p.alto;
          return (
            <g key={p.clave}>
              <text
                x={marginLeft}
                y={p.top - 12}
                fontSize={11}
                fontWeight={700}
                fill="var(--color-ink)"
              >
                {p.nombre}
              </text>
              {p.eje.marcas.map((m) => (
                <g key={m}>
                  <line
                    x1={marginLeft}
                    y1={y(m)}
                    x2={width - marginRight}
                    y2={y(m)}
                    stroke="var(--color-line)"
                    strokeWidth={1}
                  />
                  <text
                    x={marginLeft - 8}
                    y={y(m) + 4}
                    fontSize={10}
                    textAnchor="end"
                    fill="var(--color-muted)"
                  >
                    {p.formato(m)}
                  </text>
                </g>
              ))}
              {p.valores.slice(0, hasta).map((v, i) => {
                const activo = seleccionado === i + 1;
                const alto = (v / p.eje.techo) * p.alto;
                return (
                  <rect
                    key={i}
                    x={xFor(i)}
                    y={p.top + p.alto - Math.max(alto, 1)}
                    width={barWidth}
                    height={Math.max(alto, 1)}
                    rx={n > 6 ? 2 : 4}
                    fill={activo ? 'var(--color-brand-red-dark)' : 'var(--color-brand-red)'}
                    // La comisión, un poco más clara: se distingue de un vistazo
                    // cuál panel es cuál sin sumar un segundo color de marca.
                    fillOpacity={p.clave === 'linea' && !activo ? 0.6 : 1}
                    className="cursor-pointer"
                    onClick={() => onSelect(i + 1)}
                  >
                    <title>{`${etiquetas[i]}: ${p.formato(v)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {etiquetas.map((etiqueta, i) => {
          const activo = seleccionado === i + 1;
          return (
            <text
              key={etiqueta}
              x={xFor(i) + barWidth / 2}
              y={yEtiquetas}
              textAnchor="middle"
              fontSize={n > 6 ? 11 : 12}
              fontWeight={activo ? 700 : 500}
              fill={activo ? 'var(--color-brand-red)' : 'var(--color-ink)'}
              className="cursor-pointer"
              onClick={() => onSelect(i + 1)}
            >
              {etiqueta}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        {/* En pantalla ancha cada panel tiene su título; la leyenda queda para
            las barras acostadas del celular, que muestran los dos números. */}
        <div className="flex items-center gap-4 sm:hidden">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-red" aria-hidden />
            {nombreBarras}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" aria-hidden />
            {nombreLineaCorto}
          </span>
        </div>
        <span className="sm:ml-auto">{pista}</span>
      </div>
    </div>
  );
}
