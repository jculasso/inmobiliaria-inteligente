import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifrado de secretos en reposo (AES-256-GCM), compartido por todo lo que
// guarda credenciales de terceros en la base: los refresh tokens de Google y
// las claves de API de las inmobiliarias (Tokko).
//
// El formato guardado es "iv.tag.ciphertext", cada parte en base64 — se
// autocontiene, no hace falta guardar el iv ni el tag en columnas aparte.
//
// Está acá y no duplicado por módulo a propósito: dos implementaciones de
// cifrado se separan con el tiempo, y la que quede vieja es la que expone algo.
// El nombre de la variable de entorno se pasa como parámetro solo para que el
// mensaje de error diga cuál falta.

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // recomendado para GCM

/** Deriva la clave de 32 bytes desde base64. Falla claro si falta o mide mal. */
function claveDe(encKey: string | undefined, nombreVar: string): Buffer {
  if (!encKey) {
    throw new Error(`${nombreVar} no está configurada.`);
  }
  const key = Buffer.from(encKey, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `${nombreVar} debe ser 32 bytes en base64 (mide ${key.length}). Generá una con: openssl rand -base64 32`,
    );
  }
  return key;
}

/** Encripta texto plano y devuelve "iv.tag.ciphertext" (base64). */
export function encriptarSecreto(
  plano: string,
  encKey: string | undefined,
  nombreVar = 'GOOGLE_TOKEN_ENC_KEY',
): string {
  const key = claveDe(encKey, nombreVar);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

/** Desencripta un valor "iv.tag.ciphertext" (base64) al texto plano original. */
export function desencriptarSecreto(
  guardado: string,
  encKey: string | undefined,
  nombreVar = 'GOOGLE_TOKEN_ENC_KEY',
): string {
  const key = claveDe(encKey, nombreVar);
  const [ivB64, tagB64, dataB64] = guardado.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Secreto cifrado con formato inválido.');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
