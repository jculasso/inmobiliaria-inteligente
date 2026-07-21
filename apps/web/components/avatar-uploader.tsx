'use client';

import { useState, type ChangeEvent } from 'react';
import { Avatar, type AvatarSize } from '@vacker/ui';

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
    <div className="flex flex-col items-center gap-1">
      <label
        className={`group relative inline-flex cursor-pointer ${subiendo ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Avatar nombre={nombre} fotoUrl={fotoUrl} size={size} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          {subiendo ? '…' : 'Cambiar'}
        </span>
        <input type="file" accept="image/*" className="hidden" disabled={subiendo} onChange={handleSeleccionar} />
      </label>
      {onRemove && fotoUrl && (
        <button type="button" onClick={() => onRemove()} className="text-[10px] text-brand-red hover:underline">
          Quitar
        </button>
      )}
      {error && <p className="text-[10px] text-brand-red">{error}</p>}
    </div>
  );
}
