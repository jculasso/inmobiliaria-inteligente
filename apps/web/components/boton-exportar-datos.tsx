'use client';

import { useState } from 'react';
import { getAccessToken } from '../lib/supabase/client';
import { exportarDatos } from '../lib/exportacion-api';

/**
 * "Sus datos son suyos."
 *
 * Va en la Home, discreto pero visible, y solo para la dirección y el admin:
 * el archivo trae la cartera entera, las comisiones de cada vendedor y los
 * datos de los propietarios.
 *
 * Descarga con un enlace `download` en vez de abrir una pestaña: una URL
 * `blob:` no lleva nombre, y un archivo llamado con un identificador al azar
 * contradice justamente lo que este botón promete
 * (CONVENCIONES_TECNICAS.md §14).
 */
export function BotonExportarDatos() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setGenerando(true);
    setError(null);
    try {
      const { blob, nombre } = await exportarDatos(await getAccessToken());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nombre}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Se libera después de que el navegador tomó el archivo.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron descargar los datos.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={descargar}
        disabled={generando}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-60"
      >
        <span aria-hidden>↓</span>
        {generando ? 'Preparando el archivo…' : 'Descargar todos mis datos'}
      </button>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-muted">
          Planillas con todo lo cargado, para abrir con Excel. Son suyos.
        </p>
      )}
    </div>
  );
}
