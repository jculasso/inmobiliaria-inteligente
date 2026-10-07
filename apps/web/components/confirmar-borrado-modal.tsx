'use client';

import { useState, type ReactNode } from 'react';
import { Button, Modal } from '@vacker/ui';
import { MensajeError } from './piezas';

/**
 * Confirmación de borrado con la ficha de lo que se va a borrar a la vista.
 *
 * Reemplaza al `window.confirm` del navegador, que solo mostraba una línea de
 * texto y no se parece en nada al resto de la app. Acá importa de verdad: el
 * implementador va a depurar la base de ventas reales, y un borrado es
 * definitivo — tiene que poder confirmar que está mirando la operación correcta
 * antes de apretar.
 */
export function ConfirmarBorradoModal({
  titulo,
  descripcion,
  detalle,
  onConfirm,
  onClose,
  verbo = { boton: 'Sí, borrar', enCurso: 'Borrando…' },
}: {
  titulo: string;
  /** Bajada del modal: qué implica borrar esto. */
  descripcion: string;
  /** Ficha con los datos que identifican el registro. */
  detalle: ReactNode;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  /** El botón dice lo mismo que el título: «Quitar …» no confirma con «Sí, borrar». */
  verbo?: { boton: string; enCurso: string };
}) {
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setBorrando(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
      setBorrando(false);
    }
  }

  return (
    <Modal title={titulo} onClose={onClose} cerrable={!borrando}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-ink">{descripcion}</p>

        <div className="rounded-brand border border-line bg-surface p-3">{detalle}</div>

        <p className="text-xs font-semibold text-danger">Esta acción no se puede deshacer.</p>

        <MensajeError>{error}</MensajeError>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={borrando}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="peligro"
            onClick={() => void confirmar()}
            disabled={borrando}
          >
            {borrando ? verbo.enCurso : verbo.boton}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Par etiqueta/valor para la ficha del modal. */
export function DatoBorrado({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted">
        {etiqueta}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-ink">{children}</span>
    </div>
  );
}
