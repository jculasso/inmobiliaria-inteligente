/**
 * Achicar una foto en el teléfono ANTES de subirla.
 *
 * Una foto de un iPhone pesa 3–6 MB y la API acepta hasta 5 MB: la mitad de
 * las que se sacaban en la visita rebotaba, y las que entraban tardaban en
 * subir por datos móviles. El informe las muestra a 1/3 del ancho de una hoja
 * A4, así que con 2000 px del lado largo sobra. Dibujarla en un canvas además
 * la convierte a JPEG: una HEIC del iPhone que el navegador sabe leer sale
 * como JPEG, y la que no sabe leer se dice con un mensaje claro en vez de un
 * error del servidor.
 */

/** El lado largo máximo, en píxeles. */
export const LADO_MAXIMO = 2000;
/** Calidad del JPEG: a 0,8 no se nota la diferencia y pesa la cuarta parte. */
export const CALIDAD_JPEG = 0.8;
/** El límite de la API para cada foto. */
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;

/**
 * Las medidas de la foto reducida, manteniendo la proporción. Una foto que ya
 * entra no se agranda.
 */
export function medidasReducidas(
  ancho: number,
  alto: number,
  maximo: number = LADO_MAXIMO,
): { ancho: number; alto: number } {
  const largo = Math.max(ancho, alto);
  if (largo <= maximo || largo <= 0) return { ancho, alto };
  const escala = maximo / largo;
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** «IMG_1234.HEIC» → «IMG_1234.jpg»: el archivo que sube es un JPEG y tiene que llamarse así. */
export function nombreJpeg(nombre: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '') || 'foto';
  return `${base}.jpg`;
}

/** El mensaje cuando el navegador no puede abrir la imagen (típico: una HEIC en una computadora). */
export function mensajeNoSeLee(nombre: string): string {
  return (
    `No se pudo abrir «${nombre}». Si es una foto del iPhone en formato HEIC, ` +
    'subila desde el teléfono, o configurá la cámara en Ajustes › Cámara › Formatos › «Más compatible».'
  );
}

async function decodificar(file: File): Promise<{
  fuente: CanvasImageSource;
  ancho: number;
  alto: number;
  cerrar: () => void;
}> {
  // `createImageBitmap` respeta la orientación EXIF (una foto vertical no sale acostada).
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { fuente: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() };
    } catch {
      // Algunos navegadores no aceptan la opción o el formato: se prueba con <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(mensajeNoSeLee(file.name)));
      el.src = url;
    });
    return {
      fuente: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      cerrar: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * La foto lista para subir: JPEG, a lo sumo `LADO_MAXIMO` px del lado largo.
 * Tira un `Error` con un mensaje para la persona si no se puede leer o si,
 * aun reducida, supera el límite de la API.
 */
export async function reducirFoto(file: File): Promise<File> {
  const { fuente, ancho, alto, cerrar } = await decodificar(file);
  try {
    const medidas = medidasReducidas(ancho, alto);
    const canvas = document.createElement('canvas');
    canvas.width = medidas.ancho;
    canvas.height = medidas.alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(mensajeNoSeLee(file.name));
    // Fondo blanco: un PNG con transparencia saldría con fondo negro en JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, medidas.ancho, medidas.alto);
    ctx.drawImage(fuente, 0, 0, medidas.ancho, medidas.alto);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
    );
    if (!blob) throw new Error(mensajeNoSeLee(file.name));
    if (blob.size > MAX_BYTES_FOTO) {
      throw new Error(
        `«${file.name}» sigue pesando más de 5 MB aun reducida. Probá con otra foto.`,
      );
    }
    return new File([blob], nombreJpeg(file.name), { type: 'image/jpeg' });
  } finally {
    cerrar();
  }
}
