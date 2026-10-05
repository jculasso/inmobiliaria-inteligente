import { describe, expect, it } from 'vitest';
import { marcasDelEje } from './eje';
import { fmtK } from './format';

const etiquetas = (max: number) => marcasDelEje(max).marcas.map((m) => `$${fmtK(m)}`);

describe('marcasDelEje', () => {
  /*
   * Los dos casos que vio Javier en la demo de Alteva, el 5/10/2026: la comisión
   * de alquileres llegaba a 4.900 y el eje decía $1k, $3k, $4k, $5k; la de
   * ventas a 87.130 y decía $23k, $45k, $68k, $90k.
   */
  it('alquileres: el eje no se saltea ningún mil', () => {
    expect(etiquetas(4900)).toEqual(['$0', '$1k', '$2k', '$3k', '$4k', '$5k']);
  });

  it('ventas: marcas redondas, no cuartos de 90.000', () => {
    expect(etiquetas(87_130)).toEqual(['$0', '$20k', '$40k', '$60k', '$80k', '$100k']);
  });

  it('millones: el volumen mensual', () => {
    expect(etiquetas(3_576_000)).toEqual(['$0', '$1M', '$2M', '$3M', '$4M']);
  });

  /*
   * La regla de fondo, para cualquier máximo: lo que dice cada etiqueta es el
   * valor exacto de su marca. Si `fmtK` tiene que redondear, la etiqueta miente.
   */
  it('ninguna etiqueta redondea su marca', () => {
    for (const max of [7, 45, 380, 999, 1_200, 2_400, 4_900, 12_345, 87_130, 250_000, 1_100_000, 3_576_000, 18_000_000]) {
      for (const m of marcasDelEje(max).marcas) {
        const texto = fmtK(m);
        const leido = texto.endsWith('M') ? Number(texto.slice(0, -1)) * 1e6 : texto.endsWith('k') ? Number(texto.slice(0, -1)) * 1e3 : Number(texto);
        expect(leido, `max ${max}, marca ${m} se lee «${texto}»`).toBe(m);
      }
    }
  });

  it('el techo siempre cubre el máximo, sin dejar más de un tramo vacío', () => {
    for (const max of [1, 3, 9, 45, 4_900, 87_130, 3_576_000]) {
      const { techo, marcas } = marcasDelEje(max);
      expect(techo).toBeGreaterThanOrEqual(max);
      expect(techo - max).toBeLessThan(marcas[1]!);
    }
  });

  it('contando alquileres, las marcas son enteras', () => {
    expect(marcasDelEje(5, true).marcas).toEqual([0, 1, 2, 3, 4, 5]);
    expect(marcasDelEje(9, true).marcas).toEqual([0, 2, 4, 6, 8, 10]);
    expect(marcasDelEje(1, true).marcas).toEqual([0, 1]);
  });

  it('sin datos no divide por cero', () => {
    expect(marcasDelEje(0)).toEqual({ techo: 1, marcas: [0, 1] });
    expect(marcasDelEje(0, true).techo).toBe(4);
  });
});
