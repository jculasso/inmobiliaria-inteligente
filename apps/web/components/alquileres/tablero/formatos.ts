import type { MonedaAlquiler } from '@vacker/types';
import { fmtK, fmtMoneda, fmtNum } from '../../../lib/format';
import type { FilaDetalle } from './vistas';

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
 * del número. Por defecto suma el importe; la cobranza del mes suma también lo
 * cobrado y lo que falta (regla 187).
 */
export function totalesPorMoneda(
  filas: FilaDetalle[],
  porDefecto: MonedaAlquiler,
  campo: 'importe' | 'alquiler' | 'cobrado' | 'falta' = 'importe',
) {
  const t: Record<MonedaAlquiler, number> = { ARS: 0, USD: 0 };
  for (const f of filas) t[f.moneda ?? porDefecto] += f[campo] ?? 0;
  return { ARS: suma([t.ARS]), USD: suma([t.USD]) };
}

/** «$ 1.928.307,62 · U$S 1.409,25»: cada moneda con lo suyo, sin la que está en cero. */
export function fmtTotales(
  t: Record<MonedaAlquiler, number>,
  porDefecto: MonedaAlquiler,
  formato: (n: number, m: MonedaAlquiler) => string = fmtMoneda,
) {
  const monedas = (['ARS', 'USD'] as const).filter((m) => t[m] !== 0);
  return (monedas.length ? monedas : [porDefecto]).map((m) => formato(t[m], m)).join(' · ');
}

const simbolo = (m: MonedaAlquiler) => (m === 'USD' ? 'U$S' : '$');

/** «$ 412.300», «U$S 1.409»: el importe sin centavos, para los renglones de las tareas. */
export function fmtSinCentavos(n: number, moneda: MonedaAlquiler = 'ARS') {
  const v = Math.round(n);
  return `${v < 0 ? '-' : ''}${simbolo(moneda)} ${Math.abs(v).toLocaleString('es-AR')}`;
}

/**
 * Regla 184: el importe de una tarjeta, abreviado para que entren dos por fila
 * en el teléfono. Desde un millón, en millones con un decimal («$ 62,4 M»);
 * debajo, sin centavos («$ 412.300»). La lista de la tarjeta muestra el
 * importe exacto, y su total es exacto (regla 26).
 */
export function fmtTarjeta(n: number, moneda: MonedaAlquiler = 'ARS') {
  if (Math.abs(n) < 1_000_000) return fmtSinCentavos(n, moneda);
  const millones = (Math.abs(n) / 1_000_000).toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${n < 0 ? '-' : ''}${simbolo(moneda)} ${millones} M`;
}
