'use client';

import { useState } from 'react';
import type { DepositoDto, EstadoDeposito } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { devolverDeposito, entregarDeposito } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda, hoyIso } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { useRefrescar } from '../../lib/refrescar';
import { Dato, Insignia, Panel, type TonoInsignia } from './piezas';

const ESTADO: Record<EstadoDeposito, { texto: string; tono: TonoInsignia }> = {
  sin_deposito: { texto: 'Sin depósito', tono: 'neutro' },
  a_cobrar: { texto: 'A cobrar al inquilino', tono: 'aviso' },
  cobrado: { texto: 'Cobrado al inquilino', tono: 'exito' },
  entregado: { texto: 'Entregado al propietario', tono: 'exito' },
  devuelto: { texto: 'Devuelto', tono: 'neutro' },
};

/**
 * El depósito en garantía (punto 12 de Javier: «se le entrega al
 * propietario»). Dónde está, y las dos acciones: entregarlo al propietario en
 * su liquidación y, al terminar, devolverlo al inquilino.
 */
export function DepositoPanel({
  contratoId,
  deposito: d,
  propietarios = [],
}: {
  contratoId: string;
  deposito: DepositoDto;
  /** Los nombres de los propietarios, para decir a quién se le entrega. */
  propietarios?: string[];
}) {
  const { refrescar, refrescando } = useRefrescar();
  const [devolviendo, setDevolviendo] = useState(false);
  // Entregar mueve plata: se confirma con el importe y a quién (prueba en
  // producción, 6/10/2026: se ejecutaba con el primer toque).
  const [entregando, setEntregando] = useState(false);
  const [fecha, setFecha] = useState(hoyIso());
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const moneda = d.moneda ?? 'ARS';

  async function hacer(fn: () => Promise<unknown>) {
    setError(null);
    setOcupado(true);
    try {
      await fn();
      // El modal se cierra con el estado nuevo ya a la vista.
      await refrescar();
      setDevolviendo(false);
      setEntregando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Panel
      icono="🔐"
      titulo="Depósito en garantía"
      derecha={<Insignia tono={ESTADO[d.estado].tono}>{ESTADO[d.estado].texto}</Insignia>}
    >
      {d.estado === 'sin_deposito' ? (
        <p className="text-sm text-muted">El contrato no tiene depósito cargado.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Dato etiqueta="Importe">
              {d.importe != null && (
                <span className="font-semibold tabular-nums">{fmtMoneda(d.importe, moneda)}</span>
              )}
            </Dato>
            <Dato etiqueta="Cobrado">
              <span className="tabular-nums">{fmtMoneda(d.cobrado, moneda)}</span>
            </Dato>
            <Dato etiqueta="Gestión" className="col-span-2">
              {d.gestion === 'entrega_propietario'
                ? 'Se le entrega al propietario'
                : 'Lo retiene la inmobiliaria'}
            </Dato>
            {d.devueltoEl && <Dato etiqueta="Devuelto el">{fmtFecha(d.devueltoEl)}</Dato>}
          </dl>
          {d.estado === 'a_cobrar' && (
            <p className="text-sm text-muted">Se cobra con los cargos de ingreso, desde Cobros.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {d.estado === 'cobrado' && d.gestion === 'entrega_propietario' && (
              <Button
                variant="primary"
                size="sm"
                disabled={ocupado}
                onClick={() => {
                  setError(null);
                  setEntregando(true);
                }}
              >
                🤝 Entregar al propietario
              </Button>
            )}
            {(d.estado === 'cobrado' || d.estado === 'entregado') && (
              <Button variant="secondary" size="sm" onClick={() => setDevolviendo(true)}>
                ↩️ Registrar la devolución
              </Button>
            )}
          </div>
          {error && !devolviendo && !entregando && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}
      {entregando && (
        <Modal
          title="Entregar el depósito al propietario"
          onClose={() => setEntregando(false)}
          cerrable={!ocupado}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              Se le entregan{' '}
              <span className="font-semibold tabular-nums">{fmtMoneda(d.cobrado, moneda)}</span> a{' '}
              <span className="font-semibold">
                {propietarios.length ? propietarios.join(', ') : 'el propietario'}
              </span>
              : quedan a su favor en la cuenta corriente y se le pagan en su próxima liquidación.
            </p>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEntregando(false)} disabled={ocupado}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={ocupado}
                onClick={() =>
                  hacer(async () => entregarDeposito(await getAccessToken(), contratoId))
                }
              >
                {refrescando ? 'Actualizando…' : ocupado ? 'Entregando…' : '🤝 Entregar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {devolviendo && (
        <Modal
          title="Devolver el depósito"
          onClose={() => setDevolviendo(false)}
          cerrable={!ocupado}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              Se le reconoce al inquilino {fmtMoneda(d.cobrado, moneda)} a favor en su cuenta
              corriente
              {d.estado === 'entregado'
                ? ', y se le descuenta al propietario en su próxima liquidación'
                : ''}
              .
            </p>
            <Campo label="Fecha de devolución" requerido>
              <input
                type="date"
                className={inputClass}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Campo>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDevolviendo(false)} disabled={ocupado}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={ocupado || !fecha}
                onClick={() =>
                  hacer(async () => devolverDeposito(await getAccessToken(), contratoId, fecha))
                }
              >
                {refrescando ? 'Actualizando…' : ocupado ? 'Registrando…' : 'Registrar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
