/**
 * Que un mensaje de validación en inglés no llegue a la pantalla.
 *
 * Los schemas de @vacker/types tienen sus mensajes en castellano donde se
 * escribieron, pero una regla sin mensaje propio sale con el de Zod, en
 * inglés: el alta de contrato mostraba «Array must contain at least 1
 * element(s)» al lado de «El contrato no tiene tramos.» (prueba en
 * producción, 6/10/2026). La API manda esos mismos mensajes en `details`.
 *
 * Los mensajes por defecto de Zod 3 empiezan siempre con estas palabras; uno
 * escrito por nosotros, nunca.
 */
const POR_DEFECTO_DE_ZOD =
  /^(Required$|Expected |Invalid|Array must|String must|Number must|BigInt must|Date must|Set must|Map must|Unrecognized key|Intersection results|Too (small|big))/;

export const MENSAJE_REVISAR = 'Revisá los datos: falta uno o no tiene el formato que corresponde.';

export function esMensajeDeZod(mensaje: string): boolean {
  return POR_DEFECTO_DE_ZOD.test(mensaje.trim());
}

/** El mensaje si es nuestro; si es el de Zod en inglés, uno genérico en castellano. */
export function mensajeLegible(mensaje: string | null | undefined, generico = MENSAJE_REVISAR) {
  return !mensaje || esMensajeDeZod(mensaje) ? generico : mensaje;
}

/** El primer problema de un `safeParse` fallido, dicho en castellano. */
export function primerMensaje(
  error: { issues: { message: string }[] },
  generico = MENSAJE_REVISAR,
): string {
  return mensajeLegible(error.issues[0]?.message, generico);
}
