'use client';

import { useState, type ReactNode } from 'react';
import { Button, Modal } from '@vacker/ui';
import { Campo, inputClass } from '../form-ui';

/**
 * Regla 19: anular revierte el efecto y deja el documento tachado, con el
 * motivo. `onDone` recibe lo que devolvió `anular`: conceptos lo usa para
 * decir cuántos se anularon juntos.
 */
export function AnularModal<T = unknown>({
  titulo,
  detalle,
  anular: ejecutar,
  onClose,
  onDone,
}: {
  titulo: string;
  detalle: ReactNode;
  anular: (motivo: string) => Promise<T>;
  onClose: () => void;
  /** Si devuelve una promesa (el refresh de la página), el modal la espera ocupado. */
  onDone: (resultado: T) => void | Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  async function anular() {
    setError(null);
    setEnviando(true);
    let resultado: T;
    try {
      resultado = await ejecutar(motivo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.');
      setEnviando(false);
      return;
    }
    setActualizando(true);
    await onDone(resultado);
  }

  return (
    <Modal title={titulo} onClose={onClose} cerrable={!enviando}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-sm text-muted">{detalle}</div>
        <Campo
          label="Motivo"
          requerido
          hint="Queda en el historial, con quién lo anuló. Al menos 3 letras."
        >
          <input
            className={inputClass}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
          />
        </Campo>
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
            onClick={anular}
            disabled={enviando || motivo.trim().length < 3}
          >
            {actualizando ? 'Actualizando…' : enviando ? 'Anulando…' : 'Anular'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
