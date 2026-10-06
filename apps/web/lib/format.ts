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

/**
 * Monto de alquileres en su moneda, siempre con centavos: «$ 250.000,00» o
 * «U$S 1.200,00». Javier, 6/10/2026: un importe redondo sin «,00» al lado de
 * otro con centavos «queda mal». Igual que el recibo y la liquidación.
 */
export function fmtMoneda(n: number | null | undefined, moneda: 'ARS' | 'USD' = 'ARS'): string {
  // Redondeado a centavos primero: un resto de -0,001 no es «-$ 0,00».
  const v = Math.round((n ?? 0) * 100) / 100;
  const texto = Math.abs(v).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? '-' : ''}${moneda === 'USD' ? 'U$S' : '$'} ${texto}`;
}

/** Hoy en Argentina (UTC−3), como «2026-10-06»: después de las 21 h, `toISOString` ya da mañana. */
export function hoyIso(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

const ZONA_AR = 'America/Argentina/Buenos_Aires';

/**
 * Un momento (`2026-10-06T23:30:00Z`) con su hora, en la de Argentina:
 * «06/10/2026 20:30». Había cinco copias de este formateador y una no decía la
 * zona: en un navegador con otra hora, la firma mostraba otro día.
 */
export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  // `hourCycle: 'h23'`: sin eso, es-AR sale «11:30 p. m.», que no es como se lee una hora acá.
  const hora = new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ZONA_AR,
  });
  return `${fmtFechaDe(iso)} ${hora}`;
}

/**
 * El día de un momento, en Argentina: «06/10/2026». No es `fmtFecha(ts.slice(0, 10))`:
 * esa parte es el día en UTC, y algo registrado después de las 21 h aparecía
 * con la fecha de mañana. Un día calendario suelto («2026-10-06») va directo a
 * `fmtFecha`, que no lo corre.
 */
export function fmtFechaDe(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  if (!isoTimestamp.includes('T')) return fmtFecha(isoTimestamp);
  return new Date(isoTimestamp).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONA_AR,
  });
}
