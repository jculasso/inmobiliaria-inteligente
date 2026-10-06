'use client';

import { useEffect, useState } from 'react';
import type { LadoPunta, OperacionFiltro } from '@vacker/types';
import { Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { listOperaciones } from '../../lib/tablero-api';
import { fmtFecha, fmtNum, fmtUSD } from '../../lib/format';
import { estadoLabel, estadoTono } from '../../lib/operacion-estado';
import { Insignia, MensajeError } from '../piezas';
import { contarVentas, resumirVentas, type FocoDrill } from '../../lib/drill';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';

interface Props {
  titulo: string;
  subtitulo?: string;
  filtro: OperacionFiltro;
  /** La métrica de la tarjeta que se tocó: se resalta en el resumen de arriba. */
  foco?: FocoDrill | 'valor';
  /** Se abrió desde una tarjeta de un solo lado: «Puntas compradoras», «Com. vendedor»… */
  lado?: LadoPunta;
  onClose: () => void;
}

type Operaciones = Awaited<ReturnType<typeof listOperaciones>>;

/**
 * Las operaciones que hay detrás de una tarjeta o de una fila del tablero, de
 * solo lectura.
 *
 * Arriba, un resumen con los mismos números de las tarjetas, recalculados sobre
 * lo que se lista: el que se tocó va resaltado y tiene que dar EXACTAMENTE lo
 * mismo que la tarjeta. Abajo, cada operación con la comisión que aporta a ese
 * número —la de sus puntas contadas, no la de la operación entera—. Las reglas
 * están en `lib/drill.ts`, que cuenta por qué hacían falta.
 */
export function DetalleDrillModal({ titulo, subtitulo, filtro, foco, lado, onClose }: Props) {
  const [operaciones, setOperaciones] = useState<Operaciones | null>(null);
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
        if (!cancelado)
          setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle.');
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

  // Ventas: cada operación con las puntas que cuenta la tarjeta. Alquileres:
  // no tienen puntas, cuenta la operación entera.
  const filas = operaciones
    ? esVenta
      ? contarVentas(operaciones, { usuarioId: filtro.usuarioId, lado })
      : operaciones.map((op) => ({ op, puntas: [], comision: op.comTotal }))
    : [];

  let resumen: { clave: FocoDrill | 'valor'; label: string; valor: string }[] = [];
  if (operaciones && esVenta) {
    const r = resumirVentas(filas);
    const delLado =
      lado === 'compradora' ? ' compradoras' : lado === 'vendedora' ? ' vendedoras' : '';
    resumen = [
      { clave: 'operaciones', label: 'Operaciones', valor: fmtNum(r.operaciones) },
      { clave: 'puntas', label: `Puntas${delLado}`, valor: fmtNum(r.puntas) },
      { clave: 'volumen', label: 'Volumen', valor: fmtUSD(r.volumen) },
      { clave: 'ticket', label: 'Ticket prom.', valor: fmtUSD(r.ticket) },
      { clave: 'comision', label: 'Comisión', valor: fmtUSD(r.comision) },
    ];
  } else if (operaciones) {
    const comision = filas.reduce((s, f) => s + f.comision, 0);
    const valores = filas.reduce((s, f) => s + (f.op.valorMensual ?? 0), 0);
    resumen = [
      { clave: 'operaciones', label: 'Alquileres', valor: fmtNum(filas.length) },
      { clave: 'comision', label: 'Comisión', valor: fmtUSD(comision) },
      {
        clave: 'valor',
        label: 'Valor prom./mes',
        valor: fmtUSD(filas.length ? valores / filas.length : 0),
      },
    ];
  }
  const totalComision = filas.reduce((s, f) => s + f.comision, 0);

  /** El nombre de una punta: apagado si esta tarjeta no la cuenta. */
  const nombre = (fila: (typeof filas)[number], ladoPunta: LadoPunta) => {
    const punta = fila.op.puntas.find((p) => p.lado === ladoPunta);
    if (!punta) return <span className="text-muted">—</span>;
    const cuenta = fila.puntas.some((p) => p.lado === ladoPunta);
    return <span className={cuenta ? '' : 'text-muted/60'}>{punta.nombre}</span>;
  };

  return (
    <Modal title={titulo} subtitle={subtitulo} onClose={onClose} size="xl">
      {loading && <p className="py-6 text-sm text-muted">Cargando…</p>}
      <MensajeError>{error}</MensajeError>

      {operaciones && !loading && (
        <dl aria-label="Resumen del detalle" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {resumen.map((r) => (
            <div
              key={r.clave}
              className={`rounded-lg border px-3 py-2 ${
                foco === r.clave
                  ? 'border-brand-red/40 bg-brand-red/5'
                  : 'border-line bg-surface/50'
              }`}
            >
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {r.label}
              </dt>
              <dd
                className={`text-base font-extrabold tabular-nums ${foco === r.clave ? 'text-brand-red' : 'text-ink'}`}
              >
                {r.valor}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {operaciones && !loading && (
        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-brand border border-line sm:hidden">
          {filas.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted">Sin operaciones para mostrar.</p>
          ) : (
            <ListaTarjetas etiqueta="Operaciones del detalle">
              {filas.map((fila) => (
                <Tarjeta key={fila.op.id}>
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">{fila.op.direccion}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {fila.op.codigo} · Firma {fmtFecha(fila.op.fechaFirma)}
                      </span>
                    </span>
                    <Insignia tono={estadoTono(fila.op.estado)}>
                      {estadoLabel(fila.op.estado)}
                    </Insignia>
                  </div>
                  <CamposTarjeta>
                    <CampoTarjeta etiqueta={esVenta ? 'Precio' : 'Valor/mes'}>
                      {fmtUSD(fila.op.precio ?? fila.op.valorMensual ?? 0)}
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta="Comisión">{fmtUSD(fila.comision)}</CampoTarjeta>
                    {esVenta && (
                      <CampoTarjeta etiqueta="Vendedora">{nombre(fila, 'vendedora')}</CampoTarjeta>
                    )}
                    {esVenta && (
                      <CampoTarjeta etiqueta="Compradora">
                        {nombre(fila, 'compradora')}
                      </CampoTarjeta>
                    )}
                  </CamposTarjeta>
                </Tarjeta>
              ))}
            </ListaTarjetas>
          )}
        </div>
      )}

      {operaciones && !loading && (
        <div className="hidden max-h-[60vh] overflow-auto overscroll-x-contain rounded-brand border border-line sm:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-line text-left text-[10px] font-extrabold uppercase tracking-wider text-muted">
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Firma</th>
                <th className="px-3 py-2.5">Dirección</th>
                <th className="px-3 py-2.5 text-right">{esVenta ? 'Precio' : 'Valor/mes'}</th>
                {esVenta && <th className="px-3 py-2.5 text-right">Puntas</th>}
                {esVenta && <th className="px-3 py-2.5">Vendedora</th>}
                {esVenta && <th className="px-3 py-2.5">Compradora</th>}
                <th className="px-3 py-2.5 text-right">Comisión</th>
                <th className="px-3 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={esVenta ? 9 : 6} className="px-3 py-6 text-center text-muted">
                    Sin operaciones para mostrar.
                  </td>
                </tr>
              ) : (
                filas.map((fila) => (
                  <tr
                    key={fila.op.id}
                    className="border-b border-line transition-colors last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-3 py-2.5 text-xs text-muted">{fila.op.codigo}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">
                      {fmtFecha(fila.op.fechaFirma)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-ink">{fila.op.direccion}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {fmtUSD(fila.op.precio ?? fila.op.valorMensual ?? 0)}
                    </td>
                    {esVenta && (
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                        {fila.puntas.length}
                      </td>
                    )}
                    {esVenta && <td className="px-3 py-2.5">{nombre(fila, 'vendedora')}</td>}
                    {esVenta && <td className="px-3 py-2.5">{nombre(fila, 'compradora')}</td>}
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {fmtUSD(fila.comision)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Insignia tono={estadoTono(fila.op.estado)}>
                        {estadoLabel(fila.op.estado)}
                      </Insignia>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="sticky bottom-0 bg-surface">
                <tr className="border-t-2 border-line text-ink">
                  <td
                    className="px-3 py-3 text-[11px] font-extrabold uppercase tracking-wider"
                    colSpan={esVenta ? 7 : 4}
                  >
                    Total ({filas.length})
                  </td>
                  <td className="px-3 py-3 text-right text-base font-extrabold tabular-nums">
                    {fmtUSD(totalComision)}
                  </td>
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
