import { describe, expect, it } from 'vitest';
import { LIMITE_LISTA, LIMITE_LISTA_CON_SONDA, recortarAlLimite } from './limites';

const filas = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('tope de los listados', () => {
  it('se le pide a la base exactamente una fila de más', () => {
    // De esa fila de sobra depende poder saber que quedó algo afuera.
    expect(LIMITE_LISTA_CON_SONDA).toBe(LIMITE_LISTA + 1);
  });

  it('con menos filas que el tope, muestra todo y no avisa', () => {
    const { visibles, hayMas } = recortarAlLimite(filas(197));
    expect(visibles).toHaveLength(197);
    expect(hayMas).toBe(false);
  });

  it('justo en el tope, muestra todo y no avisa', () => {
    // El caso límite: 500 filas son exactamente las que entran, no hay más.
    const { visibles, hayMas } = recortarAlLimite(filas(LIMITE_LISTA));
    expect(visibles).toHaveLength(LIMITE_LISTA);
    expect(hayMas).toBe(false);
  });

  it('con la fila de sonda, recorta al tope y AVISA', () => {
    // Este es el caso que antes pasaba en silencio: alguien veía 500 de 1.240
    // y tomaba decisiones con datos incompletos sin enterarse.
    const { visibles, hayMas } = recortarAlLimite(filas(LIMITE_LISTA_CON_SONDA));
    expect(visibles).toHaveLength(LIMITE_LISTA);
    expect(hayMas).toBe(true);
  });

  it('no descarta filas de más por las dudas: siempre deja el tope exacto', () => {
    const { visibles } = recortarAlLimite(filas(900));
    expect(visibles).toHaveLength(LIMITE_LISTA);
  });
});
