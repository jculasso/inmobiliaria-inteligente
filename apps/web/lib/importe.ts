/**
 * Leer y escribir importes en un campo de texto, igual en todo el módulo.
 *
 * Antes cada formulario tenía su propio lector, y no coincidían: en el alta de
 * contrato «200.000» se leía como 200 (auditoría del 6/10/2026), mientras que
 * en cobros se leía bien. Uno solo, con estas reglas:
 *
 * - Con coma, es la forma argentina: los puntos son miles y la coma, decimales
 *   («1.234.567,89»).
 * - Sin coma, un punto seguido de exactamente tres cifras es de miles
 *   («200.000», «1.500.000»); seguido de una o dos, es el decimal de un
 *   teclado en inglés («1500.50»), que es lo que escribe un iPhone configurado
 *   así. Así nadie multiplica por cien sin darse cuenta.
 */
export function leerImporte(texto: string | null | undefined): number | null {
  const s = (texto ?? '').replace(/[\s$]|U\$S/g, '').trim();
  if (s === '') return null;
  let normal: string;
  if (s.includes(',')) {
    normal = s.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = s.split('.');
    const ultima = partes.at(-1)!;
    normal = partes.length > 1 && ultima.length !== 3 ? `${partes.slice(0, -1).join('')}.${ultima}` : partes.join('');
  }
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return Number.NaN;
  return Math.round(Number(normal) * 100) / 100;
}

/** Un número como se escribe en el campo: «200.000,00». */
export function escribirImporte(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Un porcentaje o una cantidad chica: el punto y la coma valen los dos como
 * decimal («8,5» = «8.5» = 8,5; «0,125» = 0,125). No se usa para importes,
 * donde el punto es de miles.
 */
export function leerNumero(texto: string | null | undefined): number | null {
  const s = (texto ?? '').trim();
  if (s === '') return null;
  return Number(s.replace(',', '.'));
}

/** Un porcentaje para leer: «8,5%». */
export function fmtPct(n: number | null | undefined): string {
  return `${(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })}%`;
}
