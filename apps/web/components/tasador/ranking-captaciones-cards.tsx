'use client';

interface Item {
  usuarioId: string;
  nombre: string;
  captadas: number;
}

interface Props {
  ranking: Item[];
  seleccionado: string | null;
  onSelect: (item: Item) => void;
}

function medalla(i: number): string {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`;
}

/**
 * Ranking de captaciones en tarjetas (avatar + medalla + barra), calcado del
 * prototipo (`.vk-rank-item`/`.vk-rank-av`/`.vk-rank-fill`) — usado en el
 * Dashboard del Tasador.
 */
export function RankingCaptacionesCards({ ranking, seleccionado, onSelect }: Props) {
  const max = Math.max(1, ...ranking.map((r) => r.captadas));

  if (ranking.length === 0) {
    return <p className="py-2.5 text-xs text-muted">Todavía no hay propiedades captadas.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {ranking.map((r, i) => {
        const top = i < 3;
        const sel = seleccionado === r.usuarioId;
        return (
          <button
            key={r.usuarioId}
            type="button"
            onClick={() => onSelect(r)}
            title={`Ver captaciones de ${r.nombre}`}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-x-0 hover:translate-x-0.5 ${
              sel
                ? 'border-brand-red bg-brand-red/5 shadow-[inset_0_0_0_1px_rgba(193,18,31,0.15)]'
                : top
                  ? 'border-line bg-gradient-to-r from-[#FFFDF6] to-white hover:border-brand-red/40'
                  : 'border-line bg-white hover:border-brand-red/40'
            }`}
          >
            <span className="w-[26px] shrink-0 text-center text-base font-extrabold text-[#9A9A9A]">
              {medalla(i)}
            </span>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                top ? 'bg-gradient-to-br from-success to-[#167a45] text-white' : 'bg-surface text-muted'
              }`}
            >
              {(r.nombre || '?').trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{r.nombre}</span>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#22b968] to-success"
                  style={{ width: `${(r.captadas / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-center text-sm font-extrabold text-success">
              {r.captadas}
            </span>
          </button>
        );
      })}
    </div>
  );
}
