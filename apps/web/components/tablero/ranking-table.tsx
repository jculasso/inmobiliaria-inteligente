'use client';

import { useState } from 'react';
import type { RankingItem } from '@vacker/types';
import { Card } from '@vacker/ui';
import { fmtNum, fmtUSD } from '../../lib/format';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export function RankingTable({ items }: { items: RankingItem[] }) {
  const [open, setOpen] = useState(true);
  const ordenado = [...items].sort((a, b) => b.volumen - a.volumen);
  const maxPeso = Math.max(...ordenado.map((i) => i.peso), 0.0001);

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-bold text-ink">Ranking de vendedores</span>
        <span className="text-sm text-muted">{open ? '▾ Ocultar' : '▸ Mostrar'}</span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-line">
          {ordenado.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Sin datos para el período seleccionado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-2">#</th>
                  <th className="px-5 py-2">Vendedor</th>
                  <th className="px-5 py-2">Volumen</th>
                  <th className="px-5 py-2">Puntas</th>
                  <th className="px-5 py-2">Comisión</th>
                  <th className="px-5 py-2">Ticket prom.</th>
                  <th className="px-5 py-2">Peso</th>
                </tr>
              </thead>
              <tbody>
                {ordenado.map((item, i) => (
                  <tr key={item.usuarioId} className={`border-t border-line ${i === 0 ? 'bg-brand-red/5' : ''}`}>
                    <td className="px-5 py-2 text-muted">{MEDALLAS[i] ?? i + 1}</td>
                    <td className="px-5 py-2 font-medium text-ink">{item.nombre}</td>
                    <td className="px-5 py-2">{fmtUSD(item.volumen)}</td>
                    <td className="px-5 py-2">{fmtNum(item.puntas)}</td>
                    <td className="px-5 py-2">{fmtUSD(item.comision)}</td>
                    <td className="px-5 py-2">{fmtUSD(item.ticketPromedio)}</td>
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-brand-red"
                            style={{ width: `${(item.peso / maxPeso) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">{Math.round(item.peso * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}
