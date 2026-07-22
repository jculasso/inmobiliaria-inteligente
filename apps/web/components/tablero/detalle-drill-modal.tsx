'use client';

import { useEffect, useState } from 'react';
import type { OperacionFiltro } from '@vacker/types';
import { Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { listOperaciones } from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';

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
  const sumPrecio = operaciones?.reduce((s, op) => s + (op.precio ?? op.valorMensual ?? 0), 0) ?? 0;
  const sumComision = operaciones?.reduce((s, op) => s + op.comTotal, 0) ?? 0;

  return (
    <Modal title={titulo} onClose={onClose} size="xl">
      {subtitulo && <p className="-mt-2 mb-3 text-xs text-muted">{subtitulo}</p>}

      {loading && <p className="py-6 text-sm text-muted">Cargando…</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      {operaciones && !loading && (
        <div className="max-h-[65vh] overflow-auto rounded-brand border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Dirección</th>
                <th className="px-3 py-2">{esVenta ? 'Precio' : 'Valor/mes'}</th>
                {esVenta && <th className="px-3 py-2">Vendedora</th>}
                {esVenta && <th className="px-3 py-2">Compradora</th>}
                <th className="px-3 py-2">Comisión</th>
                <th className="px-3 py-2">Estado</th>
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
                    <tr key={op.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 text-muted">{op.codigo}</td>
                      <td className="px-3 py-2">{op.fechaFirma ?? '—'}</td>
                      <td className="px-3 py-2">{op.direccion}</td>
                      <td className="px-3 py-2">{fmtUSD(op.precio ?? op.valorMensual ?? 0)}</td>
                      {esVenta && <td className="px-3 py-2">{vend?.nombre ?? '—'}</td>}
                      {esVenta && <td className="px-3 py-2">{comp?.nombre ?? '—'}</td>}
                      <td className="px-3 py-2">{fmtUSD(op.comTotal)}</td>
                      <td className="px-3 py-2">{op.estado}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {operaciones.length > 0 && (
              <tfoot className="sticky bottom-0 bg-white">
                <tr className="border-t-2 border-line font-bold text-ink">
                  <td className="px-3 py-2" colSpan={esVenta ? 3 : 2}>
                    Total ({operaciones.length})
                  </td>
                  <td className="px-3 py-2">{fmtUSD(sumPrecio)}</td>
                  {esVenta && <td className="px-3 py-2" />}
                  {esVenta && <td className="px-3 py-2" />}
                  <td className="px-3 py-2">{fmtUSD(sumComision)}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Modal>
  );
}
