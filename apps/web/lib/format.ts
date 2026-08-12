/** Monto en USD, redondeado, con separador de miles es-AR. Ej: fmtUSD(45231.7) -> "$45.232". */
export function fmtUSD(n: number | null | undefined): string {
  return `$${Math.round(n ?? 0).toLocaleString('es-AR')}`;
}

/** Número redondeado con separador de miles es-AR, sin prefijo de moneda. */
export function fmtNum(n: number | null | undefined): string {
  return Math.round(n ?? 0).toLocaleString('es-AR');
}

/** Abrevia un monto para ejes de gráficos. Ej: fmtK(45231) -> "45k", fmtK(1250000) -> "1.3M". */
export function fmtK(n: number | null | undefined): string {
  const v = n ?? 0;
  if (Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (Math.abs(v) >= 1_000) {
    return `${Math.round(v / 1_000)}k`;
  }
  return String(Math.round(v));
}

/**
 * Fecha ISO (`2026-08-07`) a `07/08/2026`.
 *
 * Se parte el string en vez de usar `new Date()`: las fechas del Tasador vienen
 * como día calendario sin hora, y `new Date('2026-08-07')` las interpreta en UTC
 * — en Argentina eso las corre un día para atrás y la tasación aparece con la
 * fecha del día anterior.
 *
 * Sale siempre con el mismo ancho, que es lo que permite que no se parta en dos
 * líneas dentro de una celda angosta.
 */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio}`;
}
