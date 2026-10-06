import { marcasDelEje } from '../../lib/eje';

/**
 * Barras por mes, con una segunda serie opcional al lado (el mismo mes del año
 * anterior). Cada serie tiene un tono: la principal en tinta, la de
 * comparación en gris claro. Un solo eje, así que las dos se comparan sin
 * trampa (ver `periodos-chart.tsx` sobre por qué no se mezclan escalas).
 */
export function BarrasMes({
  titulo,
  meses,
  series,
  formato,
  techoFijo,
}: {
  titulo: string;
  meses: string[];
  series: { nombre: string; valores: number[]; tenue?: boolean }[];
  formato: (n: number) => string;
  /** Para porcentajes: el eje siempre llega a 100. */
  techoFijo?: number;
}) {
  const ancho = 640;
  const alto = 180;
  const izq = 44;
  const abajo = 22;
  // Aire arriba para que la etiqueta del techo («100%») no quede cortada.
  const arriba = 8;
  const max = Math.max(0, ...series.flatMap((s) => s.valores));
  const { techo, marcas } = techoFijo ? { techo: techoFijo, marcas: [0, techoFijo / 4, techoFijo / 2, (techoFijo * 3) / 4, techoFijo] } : marcasDelEje(max, false, 4);
  const columna = (ancho - izq) / Math.max(1, meses.length);
  const barra = Math.min(22, (columna - 6) / series.length);
  const y = (v: number) => arriba + (alto - abajo - arriba) * (1 - v / techo);
  const nombreMes = (m: string) => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m.slice(5, 7)) - 1];

  return (
    <figure className="rounded-brand border border-line bg-white p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{titulo}</span>
        {series.length > 1 && (
          <span className="flex gap-3 text-xs text-muted">
            {series.map((s) => (
              <span key={s.nombre} className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.tenue ? 'bg-ink/15' : 'bg-ink'}`} />
                {s.nombre}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="mt-2 w-full" role="img" aria-label={titulo}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={izq} x2={ancho} y1={y(m)} y2={y(m)} className="stroke-line" strokeWidth={1} />
            <text x={izq - 6} y={y(m) + 3} textAnchor="end" className="fill-muted text-[10px] tabular-nums">
              {formato(m)}
            </text>
          </g>
        ))}
        {meses.map((mes, i) => (
          <g key={mes}>
            {series.map((s, j) => {
              const v = s.valores[i] ?? 0;
              const x = izq + i * columna + (columna - barra * series.length) / 2 + j * barra;
              return (
                <rect key={s.nombre} x={x} y={y(v)} width={barra - 2} height={Math.max(0, alto - abajo - y(v))} rx={2} className={s.tenue ? 'fill-ink/15' : 'fill-ink'}>
                  <title>{`${s.nombre} · ${nombreMes(mes)} ${mes.slice(0, 4)}: ${formato(v)}`}</title>
                </rect>
              );
            })}
            <text x={izq + i * columna + columna / 2} y={alto - 6} textAnchor="middle" className="fill-muted text-[10px]">
              {nombreMes(mes)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
