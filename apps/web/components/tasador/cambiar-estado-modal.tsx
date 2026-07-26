'use client';

import { useState, type FormEvent } from 'react';
import {
  EstadoTasacionSchema,
  MotivoNoCaptadaSchema,
  type CambiarEstado,
  type EstadoTasacion,
  type Exclusividad,
  type MotivoNoCaptada,
  type TasacionDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { cambiarEstadoTasacion } from '../../lib/tasador-api';
import { Campo, inputClass } from '../form-ui';

const ESTADOS = EstadoTasacionSchema.options;
const MOTIVOS = MotivoNoCaptadaSchema.options;

/** Lo que cambió, tal como lo persistió el backend — alcanza para que el llamador patchee su estado local sin refetch. */
export interface EstadoPatch {
  estado: EstadoTasacion;
  exclusividad: Exclusividad | null;
  motivoNoCaptada: string | null;
}

interface Props {
  /** Alcanza con los campos de estado — acepta tanto `TasacionDto` completo como `TasacionResumenDto`. */
  tasacion: Pick<TasacionDto, 'id' | 'direccion' | 'cliente' | 'estado' | 'exclusividad' | 'motivoNoCaptada'>;
  onClose: () => void;
  onSaved: (patch: EstadoPatch) => void;
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
      onSaved({
        estado,
        exclusividad: dto.estado === 'Captada' ? dto.exclusividad : null,
        motivoNoCaptada: dto.estado === 'No captada' ? dto.motivoNoCaptada : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setLoading(false);
    }
  }

  // El título es la DIRECCIÓN: es lo que identifica la tasación cuando hay
  // varias del mismo cliente, o el mismo agente en todas. El cliente pasa a la
  // bajada, que para eso está.
  return (
    <Modal title={`Cambiar estado — ${tasacion.direccion}`} subtitle={tasacion.cliente} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <Campo label="Estado">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoTasacion)}
            className={inputClass}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Campo>

        {estado === 'Captada' && (
          <div className="flex flex-col gap-2 rounded-brand border border-line p-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Exclusividad</span>
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
          <Campo label="Motivo">
            <select
              value={motivoNoCaptada}
              onChange={(e) => setMotivoNoCaptada(e.target.value as MotivoNoCaptada)}
              className={inputClass}
            >
              <option value="">Seleccioná un motivo…</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
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
