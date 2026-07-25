import { StreamableFile } from '@nestjs/common';

/**
 * Devuelve el PDF en la misma respuesta, en vez de subirlo a Storage y mandar
 * una URL firmada.
 *
 * Antes el camino era: generar → subir a Supabase → pedir la URL firmada →
 * que el navegador se lo baje de Supabase. Con Render y Supabase en regiones
 * distintas, eran tres viajes en serie que el usuario esperaba mirando una
 * pestaña en blanco. Ahora los bytes salen directo y el resto (guardar copia,
 * registrar auditoría) ocurre después de responder.
 */
export function pdfResponse(buffer: Buffer, nombreArchivo: string): StreamableFile {
  const ascii = nombreArchivo.replace(/[^\x20-\x7E]/g, '_');
  return new StreamableFile(buffer, {
    type: 'application/pdf',
    // `filename*` lleva el nombre real (con acentos); `filename` queda como
    // respaldo ASCII para clientes viejos.
    disposition:
      `inline; filename="${ascii}.pdf"; ` +
      `filename*=UTF-8''${encodeURIComponent(`${nombreArchivo}.pdf`)}`,
  });
}
