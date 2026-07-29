import { BadRequestException } from '@nestjs/common';

/**
 * Reglas de la foto de perfil, compartidas por los DOS caminos que la cambian:
 * el panel de plataforma (`/admin/...`) y el Tablero (dirección y admin del
 * tenant cambian la foto de su equipo sin depender de nosotros).
 *
 * Están acá y no duplicadas en cada servicio para que no se separen: si un
 * camino aceptara 10MB y el otro 5, la foto entraría o no según por dónde se
 * la suba, y eso se reporta como "a veces falla".
 */

export const AVATAR_BUCKET = 'usuarios-avatares';
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export interface AvatarFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** Extensión a partir del nombre original; si no trae, se deduce del mimetype. */
export function extensionDe(mimetype: string, originalname: string): string {
  const fromName = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '';
  if (fromName) return fromName;
  const sub = mimetype.split('/')[1];
  return sub ? `.${sub}` : '';
}

/** Falla con un mensaje que le sirve a quien está subiendo, no al log. */
export function assertAvatarValido(file: AvatarFile): void {
  if (!file.mimetype.startsWith('image/')) {
    throw new BadRequestException('El archivo debe ser una imagen.');
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new BadRequestException('La imagen no puede superar los 5MB.');
  }
}

/**
 * Ruta del archivo dentro del bucket. Es determinística por usuario —no lleva
 * uuid al azar como las fotos de tasación— así que volver a subir sobreescribe
 * en vez de dejar huérfanos que después hay que ir a limpiar.
 *
 * Que sea la misma fórmula en los dos caminos es lo que hace que el panel y el
 * Tablero pisen el MISMO archivo: un usuario, una foto.
 */
export function rutaAvatar(tenantId: string, usuarioId: string, file: AvatarFile): string {
  return `${tenantId}/${usuarioId}${extensionDe(file.mimetype, file.originalname)}`;
}

/** Path dentro del bucket a partir de la URL guardada, para poder borrarlo. */
export function pathDesdeUrl(fotoUrl: string): string | undefined {
  return fotoUrl.split(`/${AVATAR_BUCKET}/`)[1];
}
