'use client';

import { useState, type FormEvent } from 'react';
import {
  EstadoTasacionSchema,
  MotivoNoCaptadaSchema,
  type CambiarEstado,
  type EstadoTasacion,
  type MotivoNoCaptada,
  type TasacionDto,
} from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarEstadoTasacion } from '../../lib/tasador-api';
import { Modal } from '../tablero/modal';

const ESTADOS = EstadoTasacionSchema.options;
const MOTIVOS = MotivoNoCaptadaSchema.options;

interface Props {
  tasacion: TasacionDto;
  onClose: () => void;
  onSaved: () => void;
}

/** Cambia el estado de una tasación. "Captada" pide exclusividad, "No captada" pide motivo. */
export function CambiarEstadoModal({ tasacion, onClose, onSaved }: Props) {
  const [estado, setEstado] = useState<EstadoTasacion>(tasacion.estado);
  const [tipoExclusividad, setTipoExclusividad] = useState<'exclusiva' | 'no'>(
    tasacion.exclusividad?.tipo ?? 'exclusiva',
  );
  const [dias, setDias] = useState(
    String(tasacion.exclusividad?.tipo === 'exclusiva' ? tasacion.exclusividad.dias : 30),
  );
  const [motivoNoCaptada, setMotivoNoCaptada] = useState<MotivoNoCaptada | ''>(
    (tasacion.motivoNoCaptada as MotivoNoCaptada) || '',
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let dto: CambiarEstado;
    if (estado === 'Captada') {
      dto =
        tipoExclusividad === 'exclusiva'
          ? { estado, exclusividad: { tipo: 'exclusiva', dias: Number(dias) || 1 } }
          : { estado, exclusividad: { tipo: 'no' } };
    } else if (estado === 'No captada') {
      if (!motivoNoCaptada) {
        setError('Elegí el motivo por el que no se captó.');
        return;
      }
      dto = { estado, motivoNoCaptada };
    } else {
      dto = { estado };
    }

    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      await cambiarEstadoTasacion(accessToken, tasacion.id, dto);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Cambiar estado — ${tasacion.cliente}`} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Estado</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoTasacion)}
            className="h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        {estado === 'Captada' && (
          <div className="flex flex-col gap-2 rounded-brand border border-line p-3">
            <span className="text-sm font-medium text-ink">Exclusividad</span>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                checked={tipoExclusividad === 'exclusiva'}
                onChange={() => setTipoExclusividad('exclusiva')}
              />
              Exclusiva
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                disabled={tipoExclusividad !== 'exclusiva'}
                className="h-8 w-20 rounded-brand border border-line px-2 text-sm disabled:bg-surface"
              />
              días
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={tipoExclusividad === 'no'} onChange={() => setTipoExclusividad('no')} />
              No exclusiva
            </label>
          </div>
        )}

        {estado === 'No captada' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Motivo</span>
            <select
              value={motivoNoCaptada}
              onChange={(e) => setMotivoNoCaptada(e.target.value as MotivoNoCaptada)}
              className="h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red"
            >
              <option value="">Seleccioná un motivo…</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
