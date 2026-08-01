/**
 * Genera planillas CSV que Excel abre bien en español.
 *
 * Toda la promesa de la exportación es que el dueño de la inmobiliaria pueda
 * abrir el archivo y entenderlo. Si lo abre y ve una sola columna con todo
 * amontonado, o "Córdoba" escrito como "CÃ³rdoba", la promesa no se cumplió.
 * De ahí las tres decisiones de este archivo:
 *
 * 1. **Marca de orden de bytes (BOM) al principio.** Sin ella, Excel en Windows
 *    supone que el archivo está en la codificación local y rompe cada acento y
 *    cada ñ.
 * 2. **Punto y coma como separador.** En la configuración regional de
 *    Argentina, Excel espera `;`. Con comas, todo el contenido cae en la
 *    primera columna.
 * 3. **Coma decimal.** Por lo mismo: `1234,56` y no `1234.56`, o los importes
 *    se leen como texto o se multiplican por cien.
 *
 * Las tres son incómodas si el archivo lo va a leer un programa, pero el
 * archivo NO es para un programa: es para una persona con Excel.
 */

const BOM = '﻿';
const SEP = ';';

/** Un valor listo para meter en una celda. */
export type Celda = string | number | boolean | Date | null | undefined;

function escapar(v: string): string {
  // Solo se encierra entre comillas si hace falta; un archivo lleno de comillas
  // innecesarias es más difícil de leer si alguien lo mira en un editor.
  if (!/[";\n\r]/.test(v)) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

/** dd/mm/aaaa — como se escriben las fechas en el resto del producto. */
export function fechaCsv(d: Date | string | null | undefined): string {
  if (!d) return '';
  const iso = typeof d === 'string' ? d : d.toISOString();
  const [a, m, dd] = iso.slice(0, 10).split('-');
  return a && m && dd ? `${dd}/${m}/${a}` : '';
}

function celda(v: Celda): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return fechaCsv(v);
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    // Coma decimal, y sin separador de miles: el separador de miles obliga a
    // encomillar y Excel a veces lo interpreta como texto.
    return String(v).replace('.', ',');
  }
  return escapar(v);
}

/**
 * Arma una planilla. `columnas` define el encabezado y el orden; cada fila es
 * un objeto con esas mismas claves.
 */
export function armarCsv<T extends Record<string, Celda>>(
  columnas: { clave: keyof T & string; titulo: string }[],
  filas: T[],
): Buffer {
  const lineas = [columnas.map((c) => escapar(c.titulo)).join(SEP)];
  for (const f of filas) {
    lineas.push(columnas.map((c) => celda(f[c.clave])).join(SEP));
  }
  // Fin de línea de Windows: es lo que espera Excel y no molesta en el resto.
  return Buffer.from(BOM + lineas.join('\r\n') + '\r\n', 'utf8');
}
