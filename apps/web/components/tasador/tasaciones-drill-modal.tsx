'use client';

import type { TasacionResumenDto } from '@vacker/types';
import { fmtUSD } from '../../lib/format';
import { detalleEstado, estadoClass } from '../../lib/tasacion-estado';
import { Modal } from '../tablero/modal';

interface Props {
  titulo: string;
  subtitulo?: string;
  tasaciones: TasacionResumenDto[];
  onClose: () => void;
}

/**
 * Detalle de solo lectura de un drill-down del dashboard — mismo patrón que
 * `DetalleDrillModal` del Tablero, pero sin fetch propio: la lista ya viene
 * resuelta de los datos que el dashboard tiene en memoria (acotados al año
 * en curso), así que no hace falta un round-trip extra por cada click.
 */
export function TasacionesDrillModal({ titulo, subtitulo, tasaciones, onClose }: Props) {
  const total = tasaciones.reduce((s, t) => s + (t.valorRecomendado ?? 0), 0);

  return (
    <Modal title={titulo} onClose={onClose} size="xl">
      {subtitulo && <p className="-mt-2 mb-3 text-xs text-muted">{subtitulo}</p>}

      <div className="max-h-[65vh] overflow-auto rounded-brand border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Dirección</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Agente</th>
              <th className="px-3 py-2">Valor recomendado</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {tasaciones.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  Sin tasaciones para mostrar.
                </td>
              </tr>
            ) : (
              tasaciones.map((t) => {
                const det = detalleEstado(t);
                return (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{t.direccion}</td>
                    <td className="px-3 py-2 text-muted">{t.cliente}</td>
                    <td className="px-3 py-2">{t.tipoPropiedad}</td>
                    <td className="px-3 py-2">{t.agente.nombre}</td>
                    <td className="px-3 py-2">{fmtUSD(t.valorRecomendado)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${estadoClass(t.estado)}`}>
                        {t.estado}
                      </span>
                      {det && <div className="mt-0.5 text-[11px] text-muted">{det}</div>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {tasaciones.length > 0 && (
            <tfoot className="sticky bottom-0 bg-white">
              <tr className="border-t-2 border-line font-bold text-ink">
                <td className="px-3 py-2" colSpan={4}>
                  Total ({tasaciones.length})
                </td>
                <td className="px-3 py-2">{fmtUSD(total)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Modal>
  );
}
