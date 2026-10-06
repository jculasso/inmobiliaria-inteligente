'use client';

import { useState } from 'react';
import type { ContratoDto } from '@vacker/types';
import { sumarDiasIso, sumarMesesIso } from '@vacker/domain';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { extenderContrato } from '../../lib/alquileres-api';
import { fmtFecha } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { leerImporte } from '../../lib/importe';
import { InputImporte } from '../input-importe';

/**
 * Extender un contrato vigente (punto 13 de Javier, como el botón de Gexion):
 * la extensión empieza al día siguiente del fin. Indexado: los tramos nuevos
 * se indexan como cualquiera. Escalonado: se indica el importe.
 */
export function ExtenderModal({ contrato: c, onClose, onDone }: { contrato: ContratoDto; onClose: () => void; onDone: () => void }) {
  const desde = sumarDiasIso(c.fin, 1);
  const [meses, setMeses] = useState(12);
  const [nuevoFin, setNuevoFin] = useState(sumarDiasIso(sumarMesesIso(desde, 12), -1));
  const [importe, setImporte] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const escalonado = c.ajuste === 'escalonado';

  async function extender() {
    setError(null);
    setEnviando(true);
    try {
      await extenderContrato(await getAccessToken(), c.id, { nuevoFin, importeBase: escalonado ? leerImporte(importe) || null : null });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo extender.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={`Extender el contrato ${c.codigo}`} subtitle={`Hoy termina el ${fmtFecha(c.fin)}. La extensión empieza el ${fmtFecha(desde)}.`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Cuántos meses">
            <input
              type="number"
              min={1}
              max={120}
              className={inputClass}
              value={meses}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value) || 1);
                setMeses(n);
                setNuevoFin(sumarDiasIso(sumarMesesIso(desde, n), -1));
              }}
            />
          </Campo>
          <Campo label="Nueva fecha de fin">
            <input type="date" className={inputClass} value={nuevoFin} min={desde} onChange={(e) => setNuevoFin(e.target.value)} />
          </Campo>
        </div>
        {escalonado ? (
          <Campo label="Importe mensual de la extensión" requerido>
            <InputImporte value={importe} onChange={setImporte} />
          </Campo>
        ) : (
          <p className="text-sm text-muted">
            Se suman tramos de {c.periodicidadMeses} meses que se indexan con {c.indice} como los demás.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={extender} disabled={enviando || nuevoFin < desde || (escalonado && !importe)}>
            {enviando ? 'Extendiendo…' : `📆 Extender hasta el ${fmtFecha(nuevoFin)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
