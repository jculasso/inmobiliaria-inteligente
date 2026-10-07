import { StreamableFile } from '@nestjs/common';

/**
 * Devuelve un Word (.docx) para descargar, con su nombre real.
 *
 * Mismo criterio que `zip-response.ts`: `filename*` lleva el nombre con
 * acentos y `filename` queda como respaldo ASCII, y el front lo baja con un
 * enlace `download` porque una URL `blob:` no lleva nombre
 * (CONVENCIONES_TECNICAS.md §14). `nombreArchivo` ya trae el `.docx`.
 */
export function docxResponse(buffer: Buffer, nombreArchivo: string): StreamableFile {
  const conExtension = /\.docx$/i.test(nombreArchivo) ? nombreArchivo : `${nombreArchivo}.docx`;
  // Sin comillas ni barras: cortarían el encabezado.
  const ascii = conExtension.replace(/[^\x20-\x7E]|["\\]/g, '_');
  return new StreamableFile(buffer, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    disposition:
      `attachment; filename="${ascii}"; ` + `filename*=UTF-8''${encodeURIComponent(conExtension)}`,
  });
}
