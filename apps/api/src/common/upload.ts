/**
 * Tope de subida, compartido por los tres endpoints que reciben archivos
 * (avatar, logo del tenant y fotos de tasación).
 *
 * Se pasa a Multer, y no solo se chequea en el servicio: sin esto el archivo
 * entero se carga en memoria ANTES de que nadie mire su tamaño, así que un
 * archivo de cientos de MB tumbaba el proceso aunque después se rechazara.
 * Con el límite acá, Multer corta la lectura apenas se pasa.
 */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Opciones de `FileInterceptor` para un único archivo acotado. */
export const uploadUnArchivo = {
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
};
