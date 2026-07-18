// Reglas de cálculo del Tasador de Propiedades. Puras y compartidas entre
// apps/api (autoritativo) y apps/web (preview en vivo del formulario) — no
// duplicar estas fórmulas en ningún otro lugar.

export interface SuperficiesInput {
  cubierta: number;
  semicubierta: number;
  descubierta: number;
}

/** Superficie total = cubierta + semicubierta (100%) + descubierta (30%). */
export function superficieTotal({ cubierta, semicubierta, descubierta }: SuperficiesInput): number {
  return cubierta + semicubierta + descubierta * 0.3;
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
