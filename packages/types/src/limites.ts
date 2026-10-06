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
 * Los conceptos de UN mes no crecen con la historia sino con la cartera: unos
 * seis por contrato. Con el tope general se cortaban a los ~85 contratos,
 * menos que la cartera de Vacker (revisión de performance del 6/10/2026).
 */
export const LIMITE_CONCEPTOS_MES = 5000;

/**
 * Separa lo que se muestra de si quedó algo afuera.
 *
 * @param filas lo que devolvió la API, que puede traer una fila de sonda.
 */
export function recortarAlLimite<T>(
  filas: T[],
  limite = LIMITE_LISTA,
): { visibles: T[]; hayMas: boolean } {
  const hayMas = filas.length > limite;
  return { visibles: hayMas ? filas.slice(0, limite) : filas, hayMas };
}
