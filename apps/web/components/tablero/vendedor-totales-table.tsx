'use client';

import { useState } from 'react';
import type { RankingItem } from '@vacker/types';
import { Avatar } from '@vacker/ui';
import { fmtNum, fmtUSD } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, TablaAncha, Tarjeta } from '../tabla-movil';
import { DetalleDrillModal } from './detalle-drill-modal';

const MEDALLAS = ['🥇', '🥈', '🥉'];

/**
 * Por qué columna se ordena.
 *
 * Vacker pidió que fuera por volumen, que es como ya estaba. Pero el criterio
 * no es el mismo para todos: una inmobiliaria mira el volumen, otra la comisión
 * —que es lo que efectivamente entra— y otra las puntas, que miden actividad y
 * no suerte. En vez de elegir por ellos, se elige en pantalla.
 */
export type CriterioOrden = 'volumen' | 'puntas' | 'comision' | 'ticketPromedio';

const CRITERIOS: { key: CriterioOrden; label: string }[] = [
  { key: 'volumen', label: 'Volumen' },
  { key: 'puntas', label: 'Puntas' },
  { key: 'comision', label: 'Comisión' },
  { key: 'ticketPromedio', label: 'Ticket prom.' },
];

/** Tabla "Totales por vendedor": la usan tanto el Ranking como el Resumen acumulado. */
/**
 * `verTodo` viaja hasta el modal de detalle a propósito.
 *
 * El backend INTERSECTA el filtro por vendedor con el alcance de vista
 * (`operaciones.service.ts`): pedir las operaciones de otra persona sin el
 * alcance devuelve vacío, no un error. O sea que el ranking listaba a todo el
 * equipo y al hacer clic en cualquiera que no fuera uno mismo, el modal se
 * abría en blanco.
 *
 * El detalle se acota además a VENTAS ESCRITURADAS, que es exactamente de lo
 * que habla este ranking: `kpis.service.ts` lo arma con
 * `ventas(tx, anio, 'escriturada')`. Sin esos dos filtros el panel listaba
 * alquileres y ventas señadas que el ranking nunca había contado — para Rocío
 * Aguilar eran 30 operaciones contra las 12 del ranking.
 */
export function VendedorTotalesTable({
  items,
  anio,
  verTodo,
}: {
  items: RankingItem[];
  anio: number;
  verTodo?: boolean;
}) {
  const [drill, setDrill] = useState<RankingItem | null>(null);
  const [criterio, setCriterio] = useState<CriterioOrden>('volumen');

  /*
   * El desempate por volumen y después por nombre no es adorno: sin él, dos
   * vendedores con las mismas puntas se intercambian de lugar cada vez que la
   * tabla se vuelve a dibujar, y el que mira cree que pasó algo.
   */
  const ordenado = [...items].sort(
    (a, b) => b[criterio] - a[criterio] || b.volumen - a.volumen || a.nombre.localeCompare(b.nombre),
  );
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
      {/*
        Va ARRIBA de las dos vistas y no en los encabezados de la tabla: en el
        celular no hay encabezados, se muestran tarjetas. Un ordenamiento que
        solo se pudiera cambiar en la computadora dejaría al vendedor en la
        calle sin poder mirar la tabla como quiere.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5 sm:px-5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Ordenar por</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Ordenar por">
          {CRITERIOS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCriterio(c.key)}
              aria-pressed={criterio === c.key}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                criterio === c.key
                  ? 'bg-brand-red text-white'
                  : 'bg-surface text-muted hover:text-ink'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

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
            {/*
              La columna por la que se está ordenando se marca en el
              encabezado. Sin esto, con la tabla ordenada por comisión, los
              números de volumen se ven desordenados y parece un error.
            */}
            {CRITERIOS.map((c) => (
              <th
                key={c.key}
                aria-sort={criterio === c.key ? 'descending' : 'none'}
                className={`px-5 py-2 ${criterio === c.key ? 'text-ink' : ''}`}
              >
                {c.label}
                {criterio === c.key && <span aria-hidden> ▾</span>}
              </th>
            ))}
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
          subtitulo={`Ventas escrituradas · Año ${anio}`}
          filtro={{ anio, usuarioId: drill.usuarioId, verTodo, tipo: 'venta', estado: 'escriturada' }}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}
