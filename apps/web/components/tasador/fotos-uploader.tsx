'use client';

import { useState } from 'react';
import type { TasacionFotoDto } from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { eliminarFotoTasacion, subirFotoTasacion } from '../../lib/tasador-api';
import { ConfirmarBorradoModal } from '../confirmar-borrado-modal';
import { CLASE_FOCO, MensajeError } from '../piezas';
import { reducirFoto } from './reducir-foto';

const MAX_FOTOS = 3;

interface Props {
  tasacionId: string;
  fotos: TasacionFotoDto[];
  onChange: (fotos: TasacionFotoDto[]) => void;
  /**
   * Se llama justo antes de abrir el selector de fotos. En el iPhone, la
   * cámara o la galería pueden hacer que el sistema descargue la página: el
   * wizard aprovecha para guardar lo que haya sin guardar.
   */
  onAntesDeElegir?: () => void;
}

/** Fotos de la propiedad (hasta 3). Sube apenas se selecciona el archivo — requiere que la tasación ya exista. */
export function FotosUploader({ tasacionId, fotos, onChange, onAntesDeElegir }: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<TasacionFotoDto | null>(null);
  const lleno = fotos.length >= MAX_FOTOS;

  async function handleSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const seleccionadas = Array.from(e.target.files ?? []);
    e.target.value = '';
    // Solo entran las que caben en el máximo (3).
    const aSubir = seleccionadas.slice(0, MAX_FOTOS - fotos.length);
    if (aSubir.length === 0) return;

    setSubiendo(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      // Secuencial: el backend asigna el `orden` según la cantidad actual, así
      // que subirlas en paralelo les daría el mismo orden a todas.
      let acumuladas = fotos;
      for (const file of aSubir) {
        const reducida = await reducirFoto(file);
        const foto = await subirFotoTasacion(accessToken, tasacionId, reducida);
        acumuladas = [...acumuladas, foto];
        onChange(acumuladas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron subir las fotos.');
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar(fotoId: string) {
    setError(null);
    const accessToken = await getAccessToken();
    await eliminarFotoTasacion(accessToken, tasacionId, fotoId);
    onChange(fotos.filter((f) => f.id !== fotoId));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Fotos de la propiedad ({fotos.length}/{MAX_FOTOS})
        </p>
        {/* El input queda accesible (sr-only, no `hidden`): con `display:none`
            el teclado no llegaba nunca al botón de cargar. */}
        <label
          onClick={() => {
            if (!lleno && !subiendo) onAntesDeElegir?.();
          }}
          className={`inline-flex h-10 cursor-pointer items-center rounded-brand border border-line px-3 text-sm font-semibold text-ink hover:bg-surface focus-within:ring-2 focus-within:ring-brand-red/40 ${
            lleno || subiendo ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {subiendo ? 'Subiendo…' : '＋ Cargar fotos'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={lleno || subiendo}
            onChange={handleSeleccionar}
          />
        </label>
      </div>

      <MensajeError>{error}</MensajeError>

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fotos.map((f, i) => (
            <div
              key={f.id}
              className="relative aspect-[4/3] overflow-hidden rounded-brand border border-line"
            >
              <img src={f.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              {/* Siempre a la vista: en el teléfono no hay «pasar el mouse por
                  encima», y con `opacity-0` hasta el hover la foto no se podía
                  borrar. 40 px para el dedo. */}
              <button
                type="button"
                onClick={() => setABorrar(f)}
                aria-label={`Borrar la foto ${i + 1}`}
                title="Borrar"
                className={`absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-lg text-white hover:bg-black/75 ${CLASE_FOCO} focus-visible:ring-white`}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {aBorrar && (
        <ConfirmarBorradoModal
          titulo="Borrar foto"
          descripcion="La foto deja de aparecer en la tasación y en el informe."
          detalle={
            <img src={aBorrar.url} alt="" className="mx-auto max-h-40 rounded-brand object-cover" />
          }
          onConfirm={() => borrar(aBorrar.id)}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}
