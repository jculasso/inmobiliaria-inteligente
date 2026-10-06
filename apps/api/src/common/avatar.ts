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

/**
 * Los formatos aceptados, reconocidos por sus primeros bytes y no por lo que
 * dice el navegador: un SVG declarado como imagen puede llevar código, y el
 * bucket es público (auditoría de seguridad del 6/10/2026).
 */
const FORMATOS = [
  { ext: '.png', mime: 'image/png', firma: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.jpg', mime: 'image/jpeg', firma: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.webp', mime: 'image/webp', firma: (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

/** La extensión sale del contenido verificado, nunca del nombre que mandó el navegador. */
export function extensionDe(file: Pick<AvatarFile, 'buffer'>): string {
  return FORMATOS.find((f) => f.firma(file.buffer))?.ext ?? '';
}

/** El tipo verificado: se guarda con este, no con el que declaró el navegador. */
export function tipoDe(file: Pick<AvatarFile, 'buffer'>): string {
  return FORMATOS.find((f) => f.firma(file.buffer))?.mime ?? 'application/octet-stream';
}

/** Falla con un mensaje que le sirve a quien está subiendo, no al log. */
export function assertAvatarValido(file: AvatarFile): void {
  if (!extensionDe(file)) {
    throw new BadRequestException('La foto tiene que ser PNG, JPG o WebP.');
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
  return `${tenantId}/${usuarioId}${extensionDe(file)}`;
}

/** Path dentro del bucket a partir de la URL guardada, para poder borrarlo. */
export function pathDesdeUrl(fotoUrl: string): string | undefined {
  return fotoUrl.split(`/${AVATAR_BUCKET}/`)[1];
}
