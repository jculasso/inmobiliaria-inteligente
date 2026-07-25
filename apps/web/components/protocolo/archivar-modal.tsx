'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MOTIVO_ARCHIVO_LABEL, type MotivoArchivo, type ProtocoloResumenDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { archivarProtocolo } from '../../lib/protocolo-api';
import { Campo, inputClass } from '../admin/form-ui';

const MOTIVOS: MotivoArchivo[] = ['vendida', 'retirada', 'vencida', 'otro'];

function hoyArg(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Cierra la comercialización de una propiedad, dejando registrado por qué. */
export function ArchivarModal({
  protocolo,
  onArchivada,
  onGuardando,
  onClose,
}: {
  protocolo: ProtocoloResumenDto;
  /** Se avisa apenas se confirma, para mover la fila de solapa al instante. */
  onArchivada: (motivo: MotivoArchivo, fecha: string) => void;
  onGuardando: (v: boolean) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState<MotivoArchivo>('vendida');
  const [fecha, setFecha] = useState(hoyArg());
  const [observacion, setObservacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // La fila se mueve y el modal se cierra ya; el guardado sigue en segundo
    // plano con el cartel de "Guardando…" a la vista.
    onArchivada(motivo, fecha);
    onGuardando(true);
    try {
      await archivarProtocolo(await getAccessToken(), protocolo.id, {
        motivo,
        fecha,
        observacion: observacion.trim() || null,
      });
    } catch (err) {
      // El refresh de abajo devuelve la fila a su lugar si el guardado falló.
      setError(err instanceof Error ? err.message : 'No se pudo archivar la propiedad.');
      setLoading(false);
    } finally {
      onGuardando(false);
      router.refresh();
    }
  }

  return (
    <Modal title="Archivar propiedad" onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="rounded-brand border border-line bg-surface px-3 py-2.5">
          <p className="text-sm font-bold text-ink">{protocolo.propiedad.direccion}</p>
          <p className="text-xs text-muted">
            {protocolo.diasPublicada} días en comercialización · avance{' '}
            {Math.round(protocolo.avance * 100)}%
          </p>
        </div>

        <Campo label="Motivo">
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoArchivo)}
            className={inputClass}
          >
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {MOTIVO_ARCHIVO_LABEL[m]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className={inputClass}
          />
        </Campo>

        <Campo label="Observación" hint="Opcional. Queda registrada junto con el motivo.">
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Detalle del cierre, condiciones acordadas, etc."
            className="min-h-[72px] w-full rounded-brand border border-line px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-red"
          />
        </Campo>

        <p className="text-xs text-muted">
          La propiedad deja de generar alertas y pasa a solo lectura. Se puede reabrir si fue un error.
        </p>

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Archivando…' : 'Archivar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
