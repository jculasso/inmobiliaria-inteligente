'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DepositoDto, EstadoDeposito } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { devolverDeposito, entregarDeposito } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda, hoyIso } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { Insignia, Panel, type TonoInsignia } from './piezas';

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
export function DepositoPanel({ contratoId, deposito: d }: { contratoId: string; deposito: DepositoDto }) {
  const router = useRouter();
  const [devolviendo, setDevolviendo] = useState(false);
  const [fecha, setFecha] = useState(hoyIso());
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const moneda = d.moneda ?? 'ARS';

  async function hacer(fn: () => Promise<unknown>) {
    setError(null);
    setOcupado(true);
    try {
      await fn();
      setDevolviendo(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Panel icono="🔐" titulo="Depósito en garantía" derecha={<Insignia tono={ESTADO[d.estado].tono}>{ESTADO[d.estado].texto}</Insignia>}>
      {d.estado === 'sin_deposito' ? (
        <p className="text-sm text-muted">El contrato no tiene depósito cargado.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Importe</dt>
              <dd className="font-semibold tabular-nums text-ink">{d.importe != null ? fmtMoneda(d.importe, moneda) : '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Cobrado</dt>
              <dd className="tabular-nums text-ink">{fmtMoneda(d.cobrado, moneda)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Gestión</dt>
              <dd className="text-ink">{d.gestion === 'entrega_propietario' ? 'Se le entrega al propietario' : 'Lo retiene la inmobiliaria'}</dd>
            </div>
            {d.devueltoEl && (
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Devuelto el</dt>
                <dd className="text-ink">{fmtFecha(d.devueltoEl)}</dd>
              </div>
            )}
          </dl>
          {d.estado === 'a_cobrar' && <p className="text-sm text-muted">Se cobra con los cargos de ingreso, desde Cobros.</p>}
          <div className="flex flex-wrap gap-2">
            {d.estado === 'cobrado' && d.gestion === 'entrega_propietario' && (
              <Button variant="primary" size="sm" disabled={ocupado} onClick={() => hacer(async () => entregarDeposito(await getAccessToken(), contratoId))}>
                🤝 Entregar al propietario
              </Button>
            )}
            {(d.estado === 'cobrado' || d.estado === 'entregado') && (
              <Button variant="secondary" size="sm" onClick={() => setDevolviendo(true)}>
                ↩️ Registrar la devolución
              </Button>
            )}
          </div>
          {error && !devolviendo && (
            <p role="alert" className="text-sm font-medium text-brand-red">
              {error}
            </p>
          )}
        </div>
      )}
      {devolviendo && (
        <Modal title="Devolver el depósito" onClose={() => setDevolviendo(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              Se le reconoce al inquilino {fmtMoneda(d.cobrado, moneda)} a favor en su cuenta corriente
              {d.estado === 'entregado' ? ', y se le descuenta al propietario en su próxima liquidación' : ''}.
            </p>
            <Campo label="Fecha de devolución" requerido>
              <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            {error && (
              <p role="alert" className="text-sm font-medium text-brand-red">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDevolviendo(false)}>
                Cancelar
              </Button>
              <Button variant="primary" disabled={ocupado || !fecha} onClick={() => hacer(async () => devolverDeposito(await getAccessToken(), contratoId, fecha))}>
                {ocupado ? 'Registrando…' : 'Registrar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
