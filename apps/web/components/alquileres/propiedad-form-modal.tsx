'use client';

import { useState, type FormEvent } from 'react';
import type {
  PropiedadAlquilerDto,
  PropiedadAlquilerInput,
  TipoPropiedadAlquiler,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { actualizarPropiedadAlquiler, crearPropiedadAlquiler } from '../../lib/alquileres-api';
import { Campo, inputClass, textareaClass } from '../form-ui';

export const NOMBRE_TIPO_PROPIEDAD: Record<TipoPropiedadAlquiler, string> = {
  vivienda: 'Vivienda',
  local: 'Local',
  oficina: 'Oficina',
  cochera: 'Cochera',
  otro: 'Otro',
};

/** Alta y edición de una unidad que se alquila. */
export function PropiedadFormModal({
  propiedad,
  onClose,
  onSaved,
}: {
  propiedad?: PropiedadAlquilerDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direccion, setDireccion] = useState(propiedad?.direccion ?? '');
  const [unidad, setUnidad] = useState(propiedad?.unidad ?? '');
  const [ciudad, setCiudad] = useState(propiedad?.ciudad ?? '');
  const [tipo, setTipo] = useState<TipoPropiedadAlquiler | ''>(propiedad?.tipo ?? '');
  const [obs, setObs] = useState(propiedad?.obs ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const dto: PropiedadAlquilerInput = { direccion, unidad, ciudad, tipo: tipo || null, obs };
    try {
      const accessToken = await getAccessToken();
      if (propiedad) await actualizarPropiedadAlquiler(accessToken, propiedad.id, dto);
      else await crearPropiedadAlquiler(accessToken, dto);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={propiedad ? 'Editar propiedad' : 'Nueva propiedad'} onClose={onClose}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Campo label="Dirección" requerido>
            <input
              className={inputClass}
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              required
              autoFocus
            />
          </Campo>
          <Campo label="Piso / depto">
            <input
              className={inputClass}
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              placeholder="3° B"
            />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Ciudad">
            <input
              className={inputClass}
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              placeholder="Rosario"
            />
          </Campo>
          <Campo label="Tipo">
            <select
              className={inputClass}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPropiedadAlquiler | '')}
            >
              <option value="">—</option>
              {Object.entries(NOMBRE_TIPO_PROPIEDAD).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo label="Observaciones">
          <textarea
            className={textareaClass}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
