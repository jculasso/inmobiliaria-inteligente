/**
 * Los nombres de los meses, en un solo lugar.
 *
 * Estaban escritos dos veces —en el filtro de período y en el de
 * operaciones— y el 25/09/2026 hacía falta una tercera para el acumulado
 * mensual. Una lista que se copia tres veces termina con un «Setiembre» en una
 * sola de ellas.
 */
export const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Para las columnas y las barras, donde doce nombres completos no entran. */
export const ABREV_MES = NOMBRES_MES.map((m) => m.slice(0, 3));
