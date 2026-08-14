import { describe, expect, it } from 'vitest';
import {
  COEFICIENTES_POR_DEFECTO,
  promedioUsdM2,
  superficieTotal,
  usdM2,
  valoresSugeridos,
  formulaEnPalabras,
} from './tasador';

describe('superficieTotal', () => {
  it('suma cubierta + semicubierta + 30% de descubierta', () => {
    expect(superficieTotal({ cubierta: 80, semicubierta: 10, descubierta: 20 }, COEFICIENTES_POR_DEFECTO)).toBeCloseTo(96);
  });

  it('es 0 si todas las superficies son 0', () => {
    expect(superficieTotal({ cubierta: 0, semicubierta: 0, descubierta: 0 }, COEFICIENTES_POR_DEFECTO)).toBe(0);
  });
});

describe('usdM2', () => {
  it('divide precio por superficie', () => {
    expect(usdM2({ precio: 100_000, superficie: 50 })).toBe(2000);
  });

  it('devuelve 0 si la superficie es 0 (evita división por cero)', () => {
    expect(usdM2({ precio: 100_000, superficie: 0 })).toBe(0);
  });
});

describe('promedioUsdM2', () => {
  it('promedia el USD/m² de varios comparables', () => {
    const result = promedioUsdM2([
      { precio: 100_000, superficie: 50 }, // 2000
      { precio: 150_000, superficie: 50 }, // 3000
    ]);
    expect(result).toBe(2500);
  });

  it('devuelve 0 con lista vacía', () => {
    expect(promedioUsdM2([])).toBe(0);
  });
});

describe('valoresSugeridos', () => {
  it('calcula aspiracional/recomendado(-6%)/minimo(-10%)', () => {
    const result = valoresSugeridos(100, 2000);
    expect(result.aspiracional).toBe(200_000);
    expect(result.recomendado).toBeCloseTo(188_000);
    expect(result.minimo).toBeCloseTo(180_000);
  });
});

describe('los coeficientes son de cada inmobiliaria', () => {
  /*
   * Vacker cuenta la semicubierta entera y la descubierta al 30%. Otras
   * inmobiliarias usan otros números, y el criterio es lo que se discute con un
   * colega cuando dos tasaciones no coinciden.
   */
  const SUPERFICIES = { cubierta: 100, semicubierta: 20, descubierta: 50 };

  it('con el criterio de Vacker da lo de siempre', () => {
    // 100 + 20 + 15 = 135. Este número no se movió nunca y no se tiene que mover.
    expect(superficieTotal(SUPERFICIES, COEFICIENTES_POR_DEFECTO)).toBeCloseTo(135);
  });

  it('otra inmobiliaria, otro número', () => {
    // Media semicubierta y media descubierta: 100 + 10 + 25 = 135 también,
    // así que se usan valores que NO se compensen entre sí.
    expect(superficieTotal(SUPERFICIES, { semicubierta: 0.5, descubierta: 0.1 })).toBeCloseTo(115);
  });

  it('una inmobiliaria puede no contar la descubierta', () => {
    expect(superficieTotal(SUPERFICIES, { semicubierta: 1, descubierta: 0 })).toBeCloseTo(120);
  });

  it('la cubierta siempre cuenta entera, no se configura', () => {
    // Es la definición de superficie cubierta; hacerla configurable sería
    // permitir decir que un metro construido vale medio metro.
    expect(superficieTotal({ cubierta: 80, semicubierta: 0, descubierta: 0 }, { semicubierta: 0, descubierta: 0 })).toBe(80);
  });
});

describe('formulaEnPalabras', () => {
  /*
   * El formulario muestra la fórmula al lado del total: «(cubierta +
   * semicubierta + 30% descubierta)». Estaba escrita a mano y con este cambio
   * pasaría a mentirle a cualquiera que no use el criterio de Vacker.
   */
  it('con el criterio de Vacker dice lo que decía el texto escrito a mano', () => {
    expect(formulaEnPalabras(COEFICIENTES_POR_DEFECTO)).toBe('cubierta + semicubierta + 30% descubierta');
  });

  it('muestra los porcentajes de cada una cuando no son enteros', () => {
    expect(formulaEnPalabras({ semicubierta: 0.5, descubierta: 0.25 })).toBe(
      'cubierta + 50% semicubierta + 25% descubierta',
    );
  });

  it('no nombra lo que no suma', () => {
    // Si la descubierta pesa cero, nombrarla en la fórmula haría pensar que
    // cargarla cambia algo.
    expect(formulaEnPalabras({ semicubierta: 1, descubierta: 0 })).toBe('cubierta + semicubierta');
  });
});
