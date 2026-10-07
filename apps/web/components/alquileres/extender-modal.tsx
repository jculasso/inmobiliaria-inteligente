'use client';

import { useState } from 'react';
import type { ContratoDto } from '@vacker/types';
import { generarTramos, sumarDiasIso, sumarMesesIso } from '@vacker/domain';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { extenderContrato } from '../../lib/alquileres-api';
import { fmtFecha } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { leerImporte } from '../../lib/importe';
import { InputImporte } from '../input-importe';
import { NOMBRE_INDICE } from './nombres';

/** Cuántos meses enteros van de `desde` a `hasta` (inclusive), o `null` si no son enteros. */
function mesesEnteros(desde: string, hasta: string): number | null {
  const fin = sumarDiasIso(hasta, 1);
  for (let n = 1; n <= 240; n++) {
    const f = sumarMesesIso(desde, n);
    if (f === fin) return n;
    if (f > fin) return null;
  }
  return null;
}

const duracion = (desde: string, hasta: string) => {
  const n = mesesEnteros(desde, hasta);
  return n == null
    ? `del ${fmtFecha(desde)} al ${fmtFecha(hasta)}`
    : `de ${n} ${n === 1 ? 'mes' : 'meses'}`;
};

/**
 * Lo que se suma, dicho con los tramos que va a crear la API (los mismos de
 * `generarTramos`). Antes decía siempre «tramos de 12 meses», aunque se
 * extendiera 6 y se creara un solo tramo de 6 (prueba en producción,
 * 6/10/2026).
 */
export function textoExtension(
  desde: string,
  nuevoFin: string,
  periodicidadMeses: number,
  indice: string,
): string {
  const tramos = generarTramos(desde, nuevoFin, periodicidadMeses);
  const ultimo = tramos.at(-1)!;
  if (tramos.length === 1)
    return `Se suma un tramo ${duracion(ultimo.desde, ultimo.hasta)} que se indexa con ${indice} como los demás.`;
  const enteros = mesesEnteros(ultimo.desde, ultimo.hasta) === periodicidadMeses;
  return `Se suman ${tramos.length} tramos de ${periodicidadMeses} meses${
    enteros ? '' : ` (el último ${duracion(ultimo.desde, ultimo.hasta)})`
  } que se indexan con ${indice} como los demás.`;
}

/**
 * Extender un contrato vigente (punto 13 de Javier, como el botón de Gexion):
 * la extensión empieza al día siguiente del fin. Indexado: los tramos nuevos
 * se indexan como cualquiera. Escalonado: se indica el importe.
 */
export function ExtenderModal({
  contrato: c,
  onClose,
  onDone,
}: {
  contrato: ContratoDto;
  onClose: () => void;
  /** Si devuelve una promesa (el refresh de la página), el modal la espera ocupado. */
  onDone: () => void | Promise<void>;
}) {
  const desde = sumarDiasIso(c.fin, 1);
  const [meses, setMeses] = useState(12);
  const [nuevoFin, setNuevoFin] = useState(sumarDiasIso(sumarMesesIso(desde, 12), -1));
  const [importe, setImporte] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const escalonado = c.ajuste === 'escalonado';

  async function extender() {
    setError(null);
    setEnviando(true);
    try {
      await extenderContrato(await getAccessToken(), c.id, {
        nuevoFin,
        importeBase: escalonado ? leerImporte(importe) || null : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo extender.');
      setEnviando(false);
      return;
    }
    setActualizando(true);
    await onDone();
  }

  return (
    <Modal
      title={`Extender el contrato ${c.codigo}`}
      subtitle={`Hoy termina el ${fmtFecha(c.fin)}. La extensión empieza el ${fmtFecha(desde)}.`}
      onClose={onClose}
      cerrable={!enviando}
    >
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
            <input
              type="date"
              className={inputClass}
              value={nuevoFin}
              min={desde}
              onChange={(e) => setNuevoFin(e.target.value)}
            />
          </Campo>
        </div>
        {escalonado ? (
          <Campo label="Importe mensual de la extensión" requerido>
            <InputImporte moneda={c.moneda} value={importe} onChange={setImporte} />
          </Campo>
        ) : (
          nuevoFin >= desde && (
            <p className="text-sm text-muted">
              {textoExtension(
                desde,
                nuevoFin,
                c.periodicidadMeses ?? 12,
                c.indice ? NOMBRE_INDICE[c.indice] : 'el índice del contrato',
              )}
            </p>
          )
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={extender}
            disabled={enviando || nuevoFin < desde || (escalonado && !importe)}
          >
            {actualizando
              ? 'Actualizando…'
              : enviando
                ? 'Extendiendo…'
                : `📆 Extender hasta el ${fmtFecha(nuevoFin)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
