'use client';

import { useState } from 'react';
import type { RankingItem } from '@vacker/types';
import { Avatar } from '@vacker/ui';
import { fmtNum, fmtUSD } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, TablaAncha, Tarjeta } from '../tabla-movil';
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
    <>
      <ListaTarjetas etiqueta="Totales por vendedor">
        {ordenado.map((item, i) => (
          <Tarjeta
            key={item.usuarioId}
            destacada={i === 0}
            onClick={() => setDrill(item)}
            titulo={`Ver operaciones de ${item.nombre}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-sm font-extrabold text-muted">
                {MEDALLAS[i] ?? i + 1}
              </span>
              <Avatar nombre={item.nombre} fotoUrl={item.fotoUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{item.nombre}</span>
              <span className="shrink-0 text-xs font-bold text-muted">{Math.round(item.peso * 100)}%</span>
            </div>
            <CamposTarjeta>
              <CampoTarjeta etiqueta="Volumen">{fmtUSD(item.volumen)}</CampoTarjeta>
              <CampoTarjeta etiqueta="Puntas">{fmtNum(item.puntas)}</CampoTarjeta>
              <CampoTarjeta etiqueta="Comisión">{fmtUSD(item.comision)}</CampoTarjeta>
              <CampoTarjeta etiqueta="Ticket prom.">{fmtUSD(item.ticketPromedio)}</CampoTarjeta>
            </CamposTarjeta>
          </Tarjeta>
        ))}

        <li className="mt-1 rounded-xl border-2 border-line bg-surface px-3 py-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Total general</span>
          <CamposTarjeta>
            <CampoTarjeta etiqueta="Volumen">{fmtUSD(totales.volumen)}</CampoTarjeta>
            <CampoTarjeta etiqueta="Puntas">{fmtNum(totales.puntas)}</CampoTarjeta>
            <CampoTarjeta etiqueta="Comisión">{fmtUSD(totales.comision)}</CampoTarjeta>
            <CampoTarjeta etiqueta="Ticket prom.">{fmtUSD(ticketTotal)}</CampoTarjeta>
          </CamposTarjeta>
        </li>
      </ListaTarjetas>

      <TablaAncha>
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
                  className="flex items-center gap-2 hover:text-brand-red hover:underline"
                >
                  <Avatar nombre={item.nombre} fotoUrl={item.fotoUrl} size="sm" />
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
      </TablaAncha>

      {drill && (
        <DetalleDrillModal
          titulo={drill.nombre}
          subtitulo={`Vendedor · Año ${anio}`}
          filtro={{ anio, usuarioId: drill.usuarioId }}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}
