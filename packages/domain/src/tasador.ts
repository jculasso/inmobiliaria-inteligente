// Reglas de cálculo del Tasador de Propiedades. Puras y compartidas entre
// apps/api (autoritativo) y apps/web (preview en vivo del formulario) — no
// duplicar estas fórmulas en ningún otro lugar.

export interface SuperficiesInput {
  cubierta: number;
  semicubierta: number;
  descubierta: number;
}

/**
 * Con cuánto pesa cada metro que no es cubierto.
 *
 * No es una constante universal: cada inmobiliaria tasa con su criterio. Vacker
 * cuenta la semicubierta entera y la descubierta al 30%; otras usan otros
 * números, y el que se equivoca no se entera hasta que un colega le discute la
 * valuación.
 */
export interface Coeficientes {
  /** 0..1 — cuánto de cada metro semicubierto cuenta. Vacker: 1 (el 100%). */
  semicubierta: number;
  /** 0..1 — cuánto de cada metro descubierto cuenta. Vacker: 0,3 (el 30%). */
  descubierta: number;
}

/**
 * El criterio de Vacker, que es el que tenía escrito el sistema antes de que
 * esto fuera configurable.
 *
 * Sirve para dos cosas y para nada más: el valor por defecto de una
 * inmobiliaria nueva, y el relleno de las tasaciones que ya existían. NO se usa
 * como respaldo cuando falta el dato — ver abajo por qué.
 */
export const COEFICIENTES_POR_DEFECTO: Coeficientes = { semicubierta: 1, descubierta: 0.3 };

/**
 * Superficie total = cubierta + semicubierta×coef + descubierta×coef.
 *
 * `coef` es OBLIGATORIO a propósito, aunque incomode. Si tuviera un valor por
 * defecto, el que se olvide de pasarlo obtendría el criterio de Vacker en
 * silencio y con la cuenta bien hecha — el error solo aparecería en el número
 * final de una tasación de otra inmobiliaria, meses después. Siendo
 * obligatorio, TypeScript no compila hasta que cada lugar decida cuál usar.
 */
export function superficieTotal(
  { cubierta, semicubierta, descubierta }: SuperficiesInput,
  coef: Coeficientes,
): number {
  return cubierta + semicubierta * coef.semicubierta + descubierta * coef.descubierta;
}

/** «cubierta + semicubierta + 30% descubierta», armado con los coeficientes reales. */
export function formulaEnPalabras(coef: Coeficientes): string {
  const parte = (nombre: string, c: number) =>
    c === 1 ? nombre : c === 0 ? null : `${Math.round(c * 100)}% ${nombre}`;
  return ['cubierta', parte('semicubierta', coef.semicubierta), parte('descubierta', coef.descubierta)]
    .filter(Boolean)
    .join(' + ');
}

export interface Comparable {
  precio: number;
  superficie: number;
}

/** USD/m² de un comparable. 0 si la superficie es 0 (evita división por cero). */
export function usdM2(comparable: Comparable): number {
  return comparable.superficie > 0 ? comparable.precio / comparable.superficie : 0;
}

/** Promedio de USD/m² de una lista de comparables (1..6 según el formulario). */
export function promedioUsdM2(comparables: Comparable[]): number {
  if (comparables.length === 0) return 0;
  const total = comparables.reduce((sum, c) => sum + usdM2(c), 0);
  return total / comparables.length;
}

export interface ValoresSugeridos {
  aspiracional: number;
  recomendado: number;
  minimo: number;
}

/**
 * Valores sugeridos de tasación: aspiracional = superficie total × USD/m²
 * promedio de comparables; recomendado = −6%; mínimo = −10%. Editables por el
 * usuario una vez calculados (no se recalculan solos si el usuario los toca).
 */
export function valoresSugeridos(superficieTotalM2: number, promedioUsdM2Comparables: number): ValoresSugeridos {
  const aspiracional = superficieTotalM2 * promedioUsdM2Comparables;
  return {
    aspiracional,
    recomendado: aspiracional * 0.94,
    minimo: aspiracional * 0.9,
  };
}
