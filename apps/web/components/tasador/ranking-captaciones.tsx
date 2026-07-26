'use client';

import type { RankingCaptacionItem } from '@vacker/types';
import { Avatar } from '@vacker/ui';
import { fmtNum } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';

interface Props {
  ranking: RankingCaptacionItem[];
  periodoLabel: string;
  onSelectAgente?: (usuarioId: string, nombre: string) => void;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function medalla(i: number): string {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`;
}

/** Ranking de agentes por captaciones con medallas + barra de participación — compartido entre Dashboard y Reporte. */
export function RankingCaptaciones({ ranking, periodoLabel, onSelectAgente }: Props) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-ink">
        🏆 Ranking de captaciones{' '}
        <span className="text-xs font-normal text-muted">
          ({ranking.length} agentes · {periodoLabel})
        </span>
      </p>
      <div className="rounded-brand border border-line bg-white sm:hidden">
        {ranking.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">Sin datos para mostrar.</p>
        ) : (
          <ListaTarjetas etiqueta="Ranking de captaciones">
            {ranking.map((r, i) => (
              <Tarjeta
                key={r.usuarioId}
                destacada={i === 0}
                onClick={onSelectAgente ? () => onSelectAgente(r.usuarioId, r.nombre) : undefined}
                titulo={`Ver captaciones de ${r.nombre}`}
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="w-6 shrink-0 text-center text-sm font-extrabold text-muted">
                    {medalla(i)}
                  </span>
                  <Avatar nombre={r.nombre} fotoUrl={r.fotoUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{r.nombre}</span>
                  <span className="shrink-0 text-xs font-bold text-muted">{fmtPct(r.peso)}</span>
                </div>
                <CamposTarjeta>
                  <CampoTarjeta etiqueta="Captadas">{fmtNum(r.captadas)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Total">{fmtNum(r.total)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Tasa de captación">{fmtPct(r.tasaCaptacion)}</CampoTarjeta>
                </CamposTarjeta>
              </Tarjeta>
            ))}
          </ListaTarjetas>
        )}
      </div>

      <div className="hidden overflow-x-auto overscroll-x-contain rounded-brand border border-line bg-white sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Agente</th>
              <th className="px-4 py-2">Captadas</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Tasa</th>
              <th className="px-4 py-2">Participación</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Sin datos para mostrar.
                </td>
              </tr>
            ) : (
              ranking.map((r, i) => (
                <tr key={r.usuarioId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    {onSelectAgente ? (
                      <button
                        type="button"
                        onClick={() => onSelectAgente(r.usuarioId, r.nombre)}
                        className="flex items-center gap-2 font-medium text-ink hover:text-brand-red hover:underline"
                      >
                        <span aria-hidden>{medalla(i)}</span>
                        <Avatar nombre={r.nombre} fotoUrl={r.fotoUrl} size="sm" />
                        {r.nombre}
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span aria-hidden>{medalla(i)}</span>
                        <Avatar nombre={r.nombre} fotoUrl={r.fotoUrl} size="sm" />
                        {r.nombre}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{fmtNum(r.captadas)}</td>
                  <td className="px-4 py-2 text-muted">{fmtNum(r.total)}</td>
                  <td className="px-4 py-2">{fmtPct(r.tasaCaptacion)}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
                        <span className="block h-full rounded-full bg-brand-red" style={{ width: `${r.peso * 100}%` }} />
                      </span>
                      <span className="text-muted">{fmtPct(r.peso)}</span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
