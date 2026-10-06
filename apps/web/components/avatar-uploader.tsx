'use client';

import { useState, type ChangeEvent } from 'react';
import { Avatar, type AvatarSize } from '@vacker/ui';
import { CLASE_FOCO } from './piezas';

interface Props {
  nombre: string;
  fotoUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  size?: AvatarSize;
}

/**
 * Avatar + subida de foto, genérico (sirve tanto para la foto de perfil de un
 * usuario como para el logo de un tenant) — calco de `fotos-uploader.tsx`
 * pero de una sola imagen: subir reemplaza, no agrega. `onUpload`/`onRemove`
 * quedan a cargo del llamador (cada uno pega a su propio endpoint).
 */
export function AvatarUploader({ nombre, fotoUrl, onUpload, onRemove, size = 'sm' }: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function quitar() {
    if (!onRemove) return;
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la foto.');
    }
  }

  async function handleSeleccionar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSubiendo(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      {/* `focus-within`: el campo de archivo es invisible, y sin esto con Tab no se veía dónde se estaba. */}
      <label
        className={`group relative inline-flex cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-brand-red/40 ${subiendo ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Avatar nombre={nombre} fotoUrl={fotoUrl} size={size} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          {subiendo ? '…' : 'Cambiar'}
        </span>
        {/* `sr-only` y no `hidden`: con `display: none` el campo no se alcanzaba con el teclado. */}
        <input
          type="file"
          accept="image/*"
          aria-label={`Cambiar la foto de ${nombre}`}
          className="sr-only"
          disabled={subiendo}
          onChange={handleSeleccionar}
        />
      </label>
      {onRemove && fotoUrl && (
        <button
          type="button"
          onClick={quitar}
          aria-label={`Quitar la foto de ${nombre}`}
          className={`rounded text-[10px] text-danger hover:underline ${CLASE_FOCO}`}
        >
          Quitar
        </button>
      )}
      {/* En `danger`, no en el color de la marca (CONVENCIONES §13); chico, porque vive en una columna de foto. */}
      {error && (
        <p role="alert" className="max-w-[8rem] text-center text-[10px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
