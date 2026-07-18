'use client';

import { useState } from 'react';
import type { RankingItem } from '@vacker/types';
import { fmtNum, fmtUSD } from '../../lib/format';
import { DetalleDrillModal } from './detalle-drill-modal';

const MEDALLAS = ['🥇', '🥈', '🥉'];

/** Tabla "Totales por vendedor": la usan tanto el Ranking como el Resumen acumulado. */
export function VendedorTotalesTable({ items, anio }: { items: RankingItem[]; anio: number }) {
  const [drill, setDrill] = useState<RankingItem | null>(null);
  const ordenado = [...items].sort((a, b) => b.volumen - a.volumen);
  const maxPeso = Math.max(...ordenado.map((i) => i.peso), 0.0001);

  if (ordenado.length === 0) {
    return <p className="px-5 py-6 text-sm text-muted">Sin datos para el período seleccionado.</p>;
  }

  const totales = ordenado.reduce(
    (acc, i) => ({
      volumen: acc.volumen + i.volumen,
      puntas: acc.puntas + i.puntas,
      comision: acc.comision + i.comision,
    }),
    { volumen: 0, puntas: 0, comision: 0 },
  );
  const ticketTotal = totales.puntas > 0 ? totales.volumen / totales.puntas : 0;

  return (
    <div className="overflow-x-auto">
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
              <td className="px-5 py-2 font-medium text-ink">
                <button
                  type="button"
                  onClick={() => setDrill(item)}
                  className="hover:text-brand-red hover:underline"
                >
                  {item.nombre}
                </button>
              </td>
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
        <tfoot>
          <tr className="border-t-2 border-line font-bold text-ink">
            <td className="px-5 py-2" colSpan={2}>
              TOTAL GENERAL
            </td>
            <td className="px-5 py-2">{fmtUSD(totales.volumen)}</td>
            <td className="px-5 py-2">{fmtNum(totales.puntas)}</td>
            <td className="px-5 py-2">{fmtUSD(totales.comision)}</td>
            <td className="px-5 py-2">{fmtUSD(ticketTotal)}</td>
            <td className="px-5 py-2" />
          </tr>
        </tfoot>
      </table>

      {drill && (
        <DetalleDrillModal
          titulo={drill.nombre}
          subtitulo={`Vendedor · Año ${anio}`}
          filtro={{ anio, usuarioId: drill.usuarioId }}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
