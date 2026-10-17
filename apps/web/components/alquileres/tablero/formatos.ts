import type { FilaTablero, MonedaAlquiler } from '@vacker/types';
import { fmtK, fmtMoneda, fmtNum } from '../../../lib/format';

export const pct = (parte: number, total: number) =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : '—';
export const NOMBRE_TRAMO = {
  '1-30': 'Hasta 30 días',
  '31-60': '31 a 60 días',
  '61-90': '61 a 90 días',
  '90+': 'Más de 90 días',
} as const;
export const plata = (n: number) => `$${fmtK(n)}`;
export const porcentaje = (n: number) => `${Math.round(n)}%`;
/** Suma importes de a dos decimales sin arrastrar el error de la coma flotante. */
export const suma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
export const plural = (n: number, uno: string, varios: string) =>
  `${fmtNum(n)} ${n === 1 ? uno : varios}`;

/**
 * Lo que suman las filas, moneda por moneda. Una lista puede mezclar pesos y
 * dólares (un contrato en U$S entre los propietarios a liquidar), y sumarlos
 * juntos da un número que no es de ninguna moneda. La fila sin moneda va en la
 * del número.
 */
export function totalesPorMoneda(filas: FilaTablero[], porDefecto: MonedaAlquiler) {
  const t: Record<MonedaAlquiler, number> = { ARS: 0, USD: 0 };
  for (const f of filas) t[f.moneda ?? porDefecto] += f.importe ?? 0;
  return t;
}

/** «$ 1.928.307,62 · U$S 1.409,25»: cada moneda con lo suyo, sin la que está en cero. */
export function fmtTotales(t: Record<MonedaAlquiler, number>, porDefecto: MonedaAlquiler) {
  const monedas = (['ARS', 'USD'] as const).filter((m) => t[m] !== 0);
  return (monedas.length ? monedas : [porDefecto]).map((m) => fmtMoneda(t[m], m)).join(' · ');
}
