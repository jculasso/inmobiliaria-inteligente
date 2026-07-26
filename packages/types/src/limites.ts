/**
 * Tope de filas que devuelve un listado.
 *
 * Existe como guardarraíl: sin techo, una inmobiliaria con años de histórico
 * haría que la API traiga todo de una y el navegador lo dibuje entero.
 *
 * El problema no es el tope en sí, es que sea MUDO: alguien con 1.240
 * operaciones veía 500 y no se enteraba, y podía tomar decisiones con datos
 * incompletos sin saberlo.
 *
 * Por eso la API pide una fila DE MÁS (`LIMITE_LISTA + 1`). Si vuelven
 * `LIMITE_LISTA + 1` filas, hay más de las que entran: el front muestra las
 * primeras `LIMITE_LISTA` y avisa. Cuesta una fila por consulta y no hace falta
 * contar el total aparte.
 *
 * Cuando haga falta ver TODO, esto se reemplaza por paginación real.
 */
export const LIMITE_LISTA = 500;

/** Cuánto pedirle a la base para saber si hay más de las que entran. */
export const LIMITE_LISTA_CON_SONDA = LIMITE_LISTA + 1;

/**
 * Separa lo que se muestra de si quedó algo afuera.
 *
 * @param filas lo que devolvió la API, que puede traer una fila de sonda.
 */
export function recortarAlLimite<T>(filas: T[]): { visibles: T[]; hayMas: boolean } {
  const hayMas = filas.length > LIMITE_LISTA;
  return { visibles: hayMas ? filas.slice(0, LIMITE_LISTA) : filas, hayMas };
}
