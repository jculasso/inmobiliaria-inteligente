import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Encriptación de los refresh tokens de Google en reposo (AES-256-GCM).
// La clave viene de GOOGLE_TOKEN_ENC_KEY (32 bytes en base64). El formato
// guardado es "iv.tag.ciphertext", cada parte en base64 — self-contained, no
// hace falta guardar el iv/tag en columnas aparte.

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // recomendado para GCM

/** Deriva la clave de 32 bytes desde GOOGLE_TOKEN_ENC_KEY (base64). Falla claro si falta o mide mal. */
function claveDe(encKey: string | undefined): Buffer {
  if (!encKey) {
    throw new Error('GOOGLE_TOKEN_ENC_KEY no está configurada.');
  }
  const key = Buffer.from(encKey, 'base64');
  if (key.length !== 32) {
    throw new Error(`GOOGLE_TOKEN_ENC_KEY debe ser 32 bytes en base64 (mide ${key.length}). Generá una con: openssl rand -base64 32`);
  }
  return key;
}

/** Encripta texto plano y devuelve "iv.tag.ciphertext" (base64). */
export function encriptarToken(plano: string, encKey: string | undefined): string {
  const key = claveDe(encKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

/** Desencripta un valor "iv.tag.ciphertext" (base64) al texto plano original. */
export function desencriptarToken(guardado: string, encKey: string | undefined): string {
  const key = claveDe(encKey);
  const [ivB64, tagB64, dataB64] = guardado.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Token encriptado con formato inválido.');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
