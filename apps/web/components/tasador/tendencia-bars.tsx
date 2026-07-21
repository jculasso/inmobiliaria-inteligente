'use client';

export interface TendenciaBar {
  label: string;
  full: string;
  total: number;
}

/**
 * Barras verticales ancladas abajo, número arriba, etiqueta abajo — calcado del
 * prototipo (`.vk-bars`/`.vk-bar-col`/`.vk-bar-fill`), sin eje ni gridlines.
 */
export function TendenciaBars({
  datos,
  seleccionado,
  onSelect,
}: {
  datos: TendenciaBar[];
  seleccionado: string | null;
  onSelect: (bar: TendenciaBar) => void;
}) {
  const max = Math.max(1, ...datos.map((d) => d.total));

  return (
    <div className="flex h-[190px] items-end justify-between gap-2.5">
      {datos.map((d) => {
        const sel = seleccionado === d.full;
        return (
          <button
            key={d.full}
            type="button"
            onClick={() => onSelect(d)}
            disabled={d.total === 0}
            title={`Ver tasaciones de ${d.full}`}
            className={`flex h-full flex-1 flex-col items-center rounded-lg transition-colors ${
              sel ? 'bg-brand-red/10' : d.total > 0 ? 'hover:bg-brand-red/10' : 'cursor-default'
            }`}
          >
            <span
              className={`mb-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                sel ? 'bg-brand-red text-white' : 'bg-surface text-ink'
              }`}
            >
              {d.total}
            </span>
            <span className="flex w-full max-w-[46px] flex-1 items-end">
              <span
                className="w-full rounded-t-[7px] rounded-b-[3px] shadow-[0_2px_6px_rgba(193,18,31,0.2)]"
                style={{
                  height: `${Math.max((d.total / max) * 100, d.total > 0 ? 2 : 0)}%`,
                  minHeight: d.total > 0 ? 4 : 0,
                  background: 'linear-gradient(180deg, #d61f2c, #8f0d18)',
                  filter: sel ? 'brightness(1.08)' : undefined,
                }}
              />
            </span>
            <span className="mt-2 text-[11px] font-semibold text-muted">{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}
