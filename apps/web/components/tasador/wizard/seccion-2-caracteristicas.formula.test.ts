import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fuente = readFileSync(path.join(__dirname, 'seccion-2-caracteristicas.tsx'), 'utf8');

/**
 * La fórmula que se muestra al lado de la superficie total tiene que salir del
 * criterio de la inmobiliaria, no estar escrita a mano.
 *
 * Estuvo escrita a mano —«(cubierta + semicubierta + 30% descubierta)»— y
 * mientras hubo un solo criterio no molestó. Desde que cada inmobiliaria carga
 * el suyo, un texto fijo le miente en la cara a la que usa otro: el número de al
 * lado está bien calculado y el paréntesis dice otra cosa.
 *
 * Es una afirmación sobre el texto del componente y no sobre lo que se ve. No
 * reemplaza mirar la pantalla; avisa si alguien vuelve a cablearla, que es la
 * manera en que esto se rompería — nadie va a borrar la función a propósito,
 * pero sí puede pegar el texto viejo mientras arregla otra cosa.
 */
describe('seccion 2 · la fórmula de la superficie', () => {
  it('se arma con los coeficientes, no está escrita a mano', () => {
    expect(fuente).toContain('formulaEnPalabras(coeficientes)');
  });

  it('no queda ningún porcentaje cableado en el texto', () => {
    // Cualquier «30% descubierta» o «100% semicubierta» dentro de un literal.
    const cableados = fuente.match(/\d+%\s*(semi)?cubierta/gi) ?? [];
    expect(cableados, `hay porcentajes escritos a mano: ${cableados.join(', ')}`).toEqual([]);
  });
});
