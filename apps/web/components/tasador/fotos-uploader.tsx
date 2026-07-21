'use client';

import { useState } from 'react';
import type { TasacionFotoDto } from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { eliminarFotoTasacion, subirFotoTasacion } from '../../lib/tasador-api';

const MAX_FOTOS = 3;

interface Props {
  tasacionId: string;
  fotos: TasacionFotoDto[];
  onChange: (fotos: TasacionFotoDto[]) => void;
}

/** Fotos de la propiedad (hasta 3). Sube apenas se selecciona el archivo — requiere que la tasación ya exista. */
export function FotosUploader({ tasacionId, fotos, onChange }: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSubiendo(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      const foto = await subirFotoTasacion(accessToken, tasacionId, file);
      onChange([...fotos, foto]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function handleEliminar(fotoId: string) {
    setError(null);
    try {
      const accessToken = await getAccessToken();
      await eliminarFotoTasacion(accessToken, tasacionId, fotoId);
      onChange(fotos.filter((f) => f.id !== fotoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la foto.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Fotos de la propiedad ({fotos.length}/{MAX_FOTOS})
        </p>
        <label
          className={`cursor-pointer rounded-brand border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface ${
            fotos.length >= MAX_FOTOS || subiendo ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {subiendo ? 'Subiendo…' : '＋ Cargar foto'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={fotos.length >= MAX_FOTOS || subiendo}
            onChange={handleSeleccionar}
          />
        </label>
      </div>

      {error && <p className="text-xs text-brand-red">{error}</p>}

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="group relative aspect-[4/3] overflow-hidden rounded-brand border border-line">
              <img src={f.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleEliminar(f.id)}
                aria-label="Eliminar foto"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
