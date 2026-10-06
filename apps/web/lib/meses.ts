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

/**
 * Cuántos períodos del año ya empezaron: los meses (o trimestres) que tiene
 * sentido dibujar.
 *
 * Los que todavía no llegaron no valen cero, no existen. Dibujarlos en cero
 * hacía caer la línea de la comisión a pique en noviembre y diciembre, como
 * si el negocio se hubiera frenado. El mes en curso sí se dibuja aunque vaya
 * por la mitad: es real, y es lo que se viene a mirar.
 *
 * La fecha es la de Argentina (UTC−3, sin horario de verano): a las 22 del 31
 * ya es el mes siguiente en UTC, y no en la inmobiliaria.
 */
export function periodosTranscurridos(
  anio: number,
  unidad: 'mes' | 'trimestre',
  ahora: Date = new Date(),
): number {
  const hoy = new Date(ahora.getTime() - 3 * 3600 * 1000);
  const total = unidad === 'mes' ? 12 : 4;
  if (anio < hoy.getUTCFullYear()) return total;
  if (anio > hoy.getUTCFullYear()) return 0;
  const mes = hoy.getUTCMonth() + 1;
  return unidad === 'mes' ? mes : Math.ceil(mes / 3);
}
