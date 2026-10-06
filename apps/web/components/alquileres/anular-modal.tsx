'use client';

import { useState } from 'react';
import { Button, Modal } from '@vacker/ui';
import { Campo, inputClass } from '../form-ui';

/** Regla 19: anular revierte el efecto y deja el documento tachado, con el motivo. */
export function AnularModal({
  titulo,
  detalle,
  anular: ejecutar,
  onClose,
  onDone,
}: {
  titulo: string;
  detalle: string;
  anular: (motivo: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    setError(null);
    setEnviando(true);
    try {
      await ejecutar(motivo);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.');
      setEnviando(false);
    }
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{detalle}</p>
        <Campo label="Motivo" requerido hint="Queda en el historial, con quién lo anuló. Al menos 3 letras.">
          <input className={inputClass} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={anular} disabled={enviando || motivo.trim().length < 3}>
            {enviando ? 'Anulando…' : 'Anular'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
