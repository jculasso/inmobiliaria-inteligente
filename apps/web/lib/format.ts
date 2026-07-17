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
