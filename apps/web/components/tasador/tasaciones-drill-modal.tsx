'use client';

import type { TasacionResumenDto } from '@vacker/types';
import { Modal } from '@vacker/ui';
import { fmtUSD } from '../../lib/format';
import { detalleEstado, estadoClass } from '../../lib/tasacion-estado';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';

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

      <div className="max-h-[65vh] overflow-y-auto rounded-brand border border-line sm:hidden">
        {tasaciones.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted">Sin tasaciones para mostrar.</p>
        ) : (
          <ListaTarjetas etiqueta="Tasaciones del detalle">
            {tasaciones.map((t) => {
              const det = detalleEstado(t);
              return (
                <Tarjeta key={t.id}>
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">{t.direccion}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{t.cliente}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${estadoClass(t.estado)}`}>
                        {t.estado}
                      </span>
                      {det && <span className="mt-0.5 block text-[10px] text-muted">{det}</span>}
                    </span>
                  </div>
                  <CamposTarjeta>
                    <CampoTarjeta etiqueta="Tipo">{t.tipoPropiedad}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Agente">{t.agente.nombre}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Valor recomendado">{fmtUSD(t.valorRecomendado)}</CampoTarjeta>
                  </CamposTarjeta>
                </Tarjeta>
              );
            })}
            <li className="mt-1 rounded-xl border-2 border-line bg-surface px-3 py-2.5">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">
                Total ({tasaciones.length})
              </span>
              <span className="mt-1 block text-sm font-bold text-ink">{fmtUSD(total)}</span>
            </li>
          </ListaTarjetas>
        )}
      </div>

      <div className="hidden max-h-[65vh] overflow-auto overscroll-x-contain rounded-brand border border-line sm:block">
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
