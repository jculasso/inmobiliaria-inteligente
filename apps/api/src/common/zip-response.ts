import { StreamableFile } from '@nestjs/common';

/**
 * Devuelve un ZIP en la misma respuesta, con el nombre real del archivo.
 *
 * Mismo criterio que `pdf-response.ts`: `filename*` lleva el nombre con
 * acentos y `filename` queda como respaldo ASCII. Y como con los PDF, el
 * nombre solo llega si el front lo baja con un enlace `download` — una URL
 * `blob:` no lleva nombre (ver CONVENCIONES_TECNICAS.md §14).
 */
export function zipResponse(buffer: Buffer, nombreArchivo: string): StreamableFile {
  const ascii = nombreArchivo.replace(/[^\x20-\x7E]/g, '_');
  return new StreamableFile(buffer, {
    type: 'application/zip',
    disposition:
      `attachment; filename="${ascii}.zip"; ` +
      `filename*=UTF-8''${encodeURIComponent(`${nombreArchivo}.zip`)}`,
  });
}
