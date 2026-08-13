import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(path.join(__dirname, 'operaciones-table.tsx'), 'utf8');

/**
 * El listado de operaciones tiene tres reglas de estilo que no son preferencia:
 * si alguien las borra, vuelve el problema que reportó Vacker con 39 alquileres
 * cargados — la página crecía a 2,4 pantallas y los títulos de columna se iban
 * arriba, así que a mitad de la lista no se sabía si una cifra era el valor
 * mensual o la comisión.
 *
 * Son afirmaciones sobre el texto del componente, no sobre lo que se ve. No
 * reemplazan mirar la pantalla; solo avisan si el arreglo desaparece.
 */
describe('operaciones-table · el scroll del listado', () => {
  /** El contenedor de la tabla de escritorio, con sus clases. */
  const contenedor = fuente.match(/<div className="hidden [^"]*sm:block"/)?.[0] ?? '';

  it('la tabla tiene altura propia, para que no crezca la página', () => {
    expect(contenedor).toMatch(/max-h-\[\d+vh\]/);
  });

  it('el scroll vertical queda dentro de la tabla', () => {
    // Sin esto el `sticky` del encabezado no se activa: `overflow-x-auto`
    // obliga a que el eje vertical también sea `auto`, y entonces el
    // encabezado se mide contra este contenedor y no contra la página.
    expect(contenedor).toMatch(/overflow-y-auto/);
  });

  it('todas las celdas del encabezado se quedan arriba al bajar por la lista', () => {
    const encabezado = fuente.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? '';
    const celdas = encabezado.match(/<th className="[^"]*"|thClass="[^"]*"/g) ?? [];

    // Ventas tiene nueve columnas más la de acciones; alquileres, seis. Están
    // las dos ramas en el archivo, así que acá se ven todas.
    expect(celdas.length).toBeGreaterThanOrEqual(10);
    for (const celda of celdas) {
      expect(celda, `esta celda del encabezado no se queda arriba: ${celda}`).toMatch(
        /sticky[^"]*top-0/,
      );
    }
  });

  it('la esquina de código pasa por encima del resto del encabezado', () => {
    // Se queda fija en los dos ejes a la vez: si además el z-index no fuera el
    // más alto, al desplazar de costado la taparían las otras celdas.
    const esquina = fuente.match(/thClass="sticky left-0 top-0 z-(\d+) bg-white"/);
    expect(esquina).not.toBeNull();
    const zEsquina = Number(esquina![1]);
    const zResto = (fuente.match(/sticky top-0 z-(\d+)/g) ?? []).map((c) => Number(c.match(/z-(\d+)/)![1]));
    expect(Math.min(...zResto)).toBeGreaterThan(0);
    expect(zEsquina).toBeGreaterThan(Math.max(...zResto));
  });
});
