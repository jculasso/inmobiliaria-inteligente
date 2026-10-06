'use client';

import { useEffect, useState } from 'react';
import type { ContratoDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { actualizarDatosContrato, getContrato } from '../../lib/alquileres-api';
import { Campo, inputClass, textareaClass } from '../form-ui';

/**
 * El lápiz de un contrato vigente: solo lo que no toca plata (decidido con
 * Javier el 6/10/2026). Importes, tramos y porcentajes cambian por indexación
 * o rescisión, no a mano: cambiarlos por debajo dejaría cobros calculados con
 * reglas que ya no están a la vista.
 */
export function DatosContratoModal({
  contratoId,
  onClose,
  onSaved,
}: {
  contratoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contrato, setContrato] = useState<ContratoDto | null>(null);
  const [fechaFirma, setFechaFirma] = useState('');
  const [diaVencimiento, setDiaVencimiento] = useState('5');
  const [diaPagoPropietario, setDiaPagoPropietario] = useState('10');
  const [obs, setObs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const c = await getContrato(await getAccessToken(), contratoId);
        if (!vigente) return;
        setContrato(c);
        setFechaFirma(c.fechaFirma ?? '');
        setDiaVencimiento(String(c.diaVencimiento));
        setDiaPagoPropietario(String(c.diaPagoPropietario));
        setObs(c.obs ?? '');
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo leer el contrato.');
      }
    })();
    return () => {
      vigente = false;
    };
  }, [contratoId]);

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      await actualizarDatosContrato(await getAccessToken(), contratoId, {
        fechaFirma: fechaFirma || null,
        diaVencimiento: Number(diaVencimiento),
        diaPagoPropietario: Number(diaPagoPropietario),
        obs: obs || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  }

  const dias = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <Modal
      title={contrato ? `Editar el contrato ${contrato.codigo}` : 'Editar el contrato'}
      subtitle="Está vigente: se edita lo que no toca plata."
      onClose={onClose}
    >
      {!contrato && !error ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Fecha de firma">
              <input
                type="date"
                className={inputClass}
                value={fechaFirma}
                onChange={(e) => setFechaFirma(e.target.value)}
              />
            </Campo>
            <Campo label="Vence el inquilino el día">
              <select
                className={inputClass}
                value={diaVencimiento}
                onChange={(e) => setDiaVencimiento(e.target.value)}
              >
                {dias.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Se le paga al propietario el día">
              <select
                className={inputClass}
                value={diaPagoPropietario}
                onChange={(e) => setDiaPagoPropietario(e.target.value)}
              >
                {dias.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo label="Observaciones">
            <textarea
              className={textareaClass}
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </Campo>
          <p className="text-xs text-muted">
            Los importes, los tramos y los porcentajes no se editan en un contrato vigente: cambian
            al indexar o al rescindir.
          </p>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardar} disabled={guardando || !contrato}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
