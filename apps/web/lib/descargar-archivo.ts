/**
 * Guarda un archivo que llegó como bytes, con su nombre.
 *
 * Con un enlace `download` y no abriendo una pestaña: una URL `blob:` no
 * lleva nombre, y un archivo llamado con un identificador al azar es lo
 * primero que se nota (CONVENCIONES_TECNICAS.md §14).
 */
export function descargarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera después de que el navegador tomó el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
