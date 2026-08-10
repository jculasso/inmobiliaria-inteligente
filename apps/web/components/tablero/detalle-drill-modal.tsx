'use client';

import { useEffect, useState } from 'react';
import type { OperacionFiltro } from '@vacker/types';
import { Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { listOperaciones } from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';
import { estadoBadgeClass, estadoLabel } from '../../lib/operacion-estado';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';

interface Props {
  titulo: string;
  subtitulo?: string;
  filtro: OperacionFiltro;
  onClose: () => void;
}

/**
 * Panel de detalle de solo lectura: réplica del `openDrill()` del prototipo —
 * muestra las operaciones crudas detrás de un KPI/fila, con fila de totales.
 * Reusa `listOperaciones` (mismo endpoint que Ventas/Alquileres), sin acciones
 * de editar/borrar.
 *
 * ── La comisión que se muestra depende de desde dónde se abrió ──────────────
 *
 * Si el filtro trae `usuarioId` —se entró desde la fila de un vendedor en el
 * ranking— la columna muestra SU parte, no la comisión completa de la
 * operación. En una venta compartida entre dos, `comTotal` incluye la punta del
 * otro: el ranking decía 63.210 para Rocío y el detalle sumaba 251.430.
 *
 * El ranking suma `punta.comision` (ver `kpis.calc.ts`), así que este panel
 * tiene que sumar lo mismo o los dos números nunca cierran.
 */
export function DetalleDrillModal({ titulo, subtitulo, filtro, onClose }: Props) {
  const [operaciones, setOperaciones] = useState<Awaited<ReturnType<typeof listOperaciones>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    getAccessToken()
      .then((accessToken) => listOperaciones(accessToken, filtro))
      .then((res) => {
        if (!cancelado) setOperaciones(res);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filtro)]);

  const esVenta = filtro.tipo !== 'alquiler';
  /**
   * La comisión atribuible a esta vista. Con `usuarioId` en el filtro es la
   * punta de esa persona; sin él, la comisión completa de la operación.
   */
  const comisionDe = (op: { comTotal: number; puntas: { usuarioId: string; comision: number }[] }) =>
    filtro.usuarioId
      ? op.puntas.filter((p) => p.usuarioId === filtro.usuarioId).reduce((s, p) => s + p.comision, 0)
      : op.comTotal;

  const sumPrecio = operaciones?.reduce((s, op) => s + (op.precio ?? op.valorMensual ?? 0), 0) ?? 0;
  const sumComision = operaciones?.reduce((s, op) => s + comisionDe(op), 0) ?? 0;

  return (
    <Modal title={titulo} subtitle={subtitulo} onClose={onClose} size="xl">
      {loading && <p className="py-6 text-sm text-muted">Cargando…</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      {operaciones && !loading && (
        <div className="max-h-[65vh] overflow-y-auto overflow-x-hidden rounded-brand border border-line sm:hidden">
          {operaciones.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted">Sin operaciones para mostrar.</p>
          ) : (
            <ListaTarjetas etiqueta="Operaciones del detalle">
              {operaciones.map((op) => {
                const vend = op.puntas.find((p) => p.lado === 'vendedora');
                const comp = op.puntas.find((p) => p.lado === 'compradora');
                return (
                  <Tarjeta key={op.id}>
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink">{op.direccion}</span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {op.codigo} · Firma {op.fechaFirma ?? '—'}
                        </span>
                      </span>
                      <span className={`shrink-0 ${estadoBadgeClass(op.estado)}`}>{estadoLabel(op.estado)}</span>
                    </div>
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta={esVenta ? 'Precio' : 'Valor/mes'}>
                        {fmtUSD(op.precio ?? op.valorMensual ?? 0)}
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta="Comisión">{fmtUSD(comisionDe(op))}</CampoTarjeta>
                      {esVenta && <CampoTarjeta etiqueta="Vendedora">{vend?.nombre ?? '—'}</CampoTarjeta>}
                      {esVenta && <CampoTarjeta etiqueta="Compradora">{comp?.nombre ?? '—'}</CampoTarjeta>}
                    </CamposTarjeta>
                  </Tarjeta>
                );
              })}
              <li className="mt-1 rounded-xl border-2 border-line bg-surface px-3 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
                  Total ({operaciones.length})
                </span>
                <CamposTarjeta>
                  <CampoTarjeta etiqueta={esVenta ? 'Precio' : 'Valor/mes'}>{fmtUSD(sumPrecio)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Comisión">{fmtUSD(sumComision)}</CampoTarjeta>
                </CamposTarjeta>
              </li>
            </ListaTarjetas>
          )}
        </div>
      )}

      {operaciones && !loading && (
        <div className="hidden max-h-[65vh] overflow-auto overscroll-x-contain rounded-brand border border-line sm:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Firma</th>
                <th className="px-3 py-2.5">Dirección</th>
                <th className="px-3 py-2.5 text-right">{esVenta ? 'Precio' : 'Valor/mes'}</th>
                {esVenta && <th className="px-3 py-2.5">Vendedora</th>}
                {esVenta && <th className="px-3 py-2.5">Compradora</th>}
                <th className="px-3 py-2.5 text-right">Comisión</th>
                <th className="px-3 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {operaciones.length === 0 ? (
                <tr>
                  <td colSpan={esVenta ? 8 : 6} className="px-3 py-6 text-center text-muted">
                    Sin operaciones para mostrar.
                  </td>
                </tr>
              ) : (
                operaciones.map((op) => {
                  const vend = op.puntas.find((p) => p.lado === 'vendedora');
                  const comp = op.puntas.find((p) => p.lado === 'compradora');
                  return (
                    <tr key={op.id} className="border-b border-line transition-colors last:border-0 hover:bg-surface/60">
                      <td className="px-3 py-2.5 text-xs text-muted">{op.codigo}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted">{op.fechaFirma ?? '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{op.direccion}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                        {fmtUSD(op.precio ?? op.valorMensual ?? 0)}
                      </td>
                      {esVenta && <td className="px-3 py-2.5">{vend?.nombre ?? '—'}</td>}
                      {esVenta && <td className="px-3 py-2.5">{comp?.nombre ?? '—'}</td>}
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{fmtUSD(comisionDe(op))}</td>
                      <td className="px-3 py-2.5">
                        <span className={estadoBadgeClass(op.estado)}>{estadoLabel(op.estado)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {operaciones.length > 0 && (
              <tfoot className="sticky bottom-0 bg-surface">
                <tr className="border-t-2 border-line text-ink">
                  <td className="px-3 py-3 text-[11px] font-extrabold uppercase tracking-wider" colSpan={esVenta ? 3 : 2}>
                    Total ({operaciones.length})
                  </td>
                  <td className="px-3 py-3 text-right text-base font-extrabold tabular-nums">{fmtUSD(sumPrecio)}</td>
                  {esVenta && <td className="px-3 py-3" />}
                  {esVenta && <td className="px-3 py-3" />}
                  <td className="px-3 py-3 text-right text-base font-extrabold tabular-nums">{fmtUSD(sumComision)}</td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Modal>
  );
}
