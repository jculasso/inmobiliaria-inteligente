import { describe, expect, it } from 'vitest';
import { TipoPropiedadSchema } from './tasador';
import { CAMPOS_FICHA, camposDe, caracteristicasDe, tiposQuePiden } from './tasador-ficha';

const TIPOS = TipoPropiedadSchema.options;

/**
 * Lo que motivó el cambio: al tasar un lote, el formulario preguntaba
 * dormitorios, antigüedad, si tenía balcón y si tenía vestidor. No es solo
 * ruido — un número cargado ahí después ensucia el comparable.
 */
describe('ficha del inmueble — no se pide lo que no corresponde', () => {
  it('a un terreno no le pide ambientes ni estado de conservación', () => {
    const campos = camposDe('Terreno');
    expect(campos.has('dormitorios')).toBe(false);
    expect(campos.has('banos')).toBe(false);
    expect(campos.has('ambientes')).toBe(false);
    expect(campos.has('antiguedad')).toBe(false);
    expect(campos.has('estadoInmueble')).toBe(false);
    expect(campos.has('amenities')).toBe(false);
    // Lo que sí define el valor de un lote.
    expect(campos.has('superficieTerreno')).toBe(true);
    expect(campos.has('servicios')).toBe(true);
  });

  it('a una cochera no le pide ambientes, servicios ni características', () => {
    const campos = camposDe('Cochera');
    expect(campos.has('dormitorios')).toBe(false);
    expect(campos.has('ambientes')).toBe(false);
    expect(campos.has('servicios')).toBe(false);
    expect(caracteristicasDe('Cochera')).toEqual([]);
    expect(campos.has('superficieConstruida')).toBe(true);
  });

  it('a un galpón le pide baños pero no dormitorios ni amenities', () => {
    const campos = camposDe('Galpón');
    expect(campos.has('banos')).toBe(true);
    expect(campos.has('dormitorios')).toBe(false);
    expect(campos.has('amenities')).toBe(false);
    expect(caracteristicasDe('Galpón')).toEqual([]);
  });

  it('a un departamento no le pide superficie de terreno', () => {
    // El lote es del edificio, no de la unidad.
    expect(camposDe('Departamento').has('superficieTerreno')).toBe(false);
    expect(camposDe('Casa').has('superficieTerreno')).toBe(true);
  });

  it('ningún tipo pierde los campos que valen para todos', () => {
    for (const tipo of TIPOS) {
      const campos = camposDe(tipo);
      expect(campos.has('documentacion')).toBe(true);
      expect(campos.has('aptoCredito')).toBe(true);
      expect(campos.has('expensas')).toBe(true);
    }
  });
});

/**
 * La regla con la que se armó la tabla: en la duda, se muestra. Esconder de más
 * le saca al tasador una capacidad; mostrar de más es un campo que deja vacío.
 * Estos tests la vuelven comprobable.
 */
describe('ficha del inmueble — en la duda se muestra', () => {
  it('cada campo lo sigue pidiendo al menos una tipología', () => {
    const huerfanos = CAMPOS_FICHA.filter((c) => tiposQuePiden(c).length === 0);
    expect(huerfanos).toEqual([]);
  });

  it('cada tipología conserva con qué medir la superficie', () => {
    for (const tipo of TIPOS) {
      const campos = camposDe(tipo);
      expect(campos.has('superficieConstruida') || campos.has('superficieTerreno')).toBe(true);
    }
  });

  it('«Otro» pide todo, porque no se sabe qué es', () => {
    expect(camposDe('Otro').size).toBe(CAMPOS_FICHA.length);
    expect(caracteristicasDe('Otro')).toHaveLength(12);
  });

  it('las tipologías de vivienda no perdieron nada', () => {
    for (const tipo of ['Casa', 'PH'] as const) {
      expect(camposDe(tipo).size).toBe(CAMPOS_FICHA.length);
      expect(caracteristicasDe(tipo)).toHaveLength(12);
    }
    // El departamento solo pierde el terreno.
    expect(camposDe('Departamento').size).toBe(CAMPOS_FICHA.length - 1);
    expect(caracteristicasDe('Departamento')).toHaveLength(12);
  });
});

describe('ficha del inmueble — la ficha se achica de verdad', () => {
  it('un terreno y una cochera piden mucho menos que una casa', () => {
    const casa = camposDe('Casa').size + caracteristicasDe('Casa').length;
    expect(camposDe('Terreno').size + caracteristicasDe('Terreno').length).toBeLessThan(casa / 2);
    expect(camposDe('Cochera').size + caracteristicasDe('Cochera').length).toBeLessThan(casa / 2);
  });
});
