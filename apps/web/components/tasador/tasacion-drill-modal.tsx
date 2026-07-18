'use client';

import { useEffect, useState } from 'react';
import type { TasacionDto, TasacionFiltro } from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { listTasaciones } from '../../lib/tasador-api';
import { fmtNum } from '../../lib/format';
import { Modal } from '../tablero/modal';

interface Props {
  titulo: string;
  subtitulo?: string;
  filtro: TasacionFiltro;
  onClose: () => void;
}

/**
 * Panel de detalle de solo lectura para el dashboard del Tasador — mismo
 * patrón que `DetalleDrillModal` del Tablero, para que ambos módulos se
 * sientan homogéneos (modal in-place en vez de navegar a la lista).
 */
export function TasacionDrillModal({ titulo, subtitulo, filtro, onClose }: Props) {
  const [tasaciones, setTasaciones] = useState<TasacionDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    getAccessToken()
      .then((accessToken) => listTasaciones(accessToken, filtro))
      .then((res) => {
        if (!cancelado) setTasaciones(res);
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

  return (
    <Modal title={titulo} onClose={onClose} size="xl">
      {subtitulo && <p className="-mt-2 mb-3 text-xs text-muted">{subtitulo}</p>}

      {loading && <p className="py-6 text-sm text-muted">Cargando…</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}

      {tasaciones && !loading && (
        <div className="max-h-[65vh] overflow-auto rounded-brand border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Dirección</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Sup. total</th>
                <th className="px-3 py-2">Agente</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tasaciones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted">
                    Sin tasaciones para mostrar.
                  </td>
                </tr>
              ) : (
                tasaciones.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{t.fecha}</td>
                    <td className="px-3 py-2 font-medium text-ink">{t.cliente}</td>
                    <td className="px-3 py-2">{t.direccion}</td>
                    <td className="px-3 py-2 text-muted">{t.tipoPropiedad}</td>
                    <td className="px-3 py-2">{fmtNum(t.superficieTotal)} m²</td>
                    <td className="px-3 py-2 text-muted">{t.agente.nombre}</td>
                    <td className="px-3 py-2">{t.estado}</td>
                  </tr>
                ))
              )}
            </tbody>
            {tasaciones.length > 0 && (
              <tfoot className="sticky bottom-0 bg-white">
                <tr className="border-t-2 border-line font-bold text-ink">
                  <td className="px-3 py-2" colSpan={7}>
                    Total ({tasaciones.length})
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Modal>
  );
}
