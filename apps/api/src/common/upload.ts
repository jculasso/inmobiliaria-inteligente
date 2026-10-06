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

/**
 * El PDF de un contrato: los firmados suelen ser escaneos, más pesados que una
 * foto. Mismo motivo que arriba para pasárselo a Multer.
 */
export const UPLOAD_PDF_MAX_BYTES = 15 * 1024 * 1024;

export const uploadPdf = {
  limits: { fileSize: UPLOAD_PDF_MAX_BYTES, files: 1 },
};
