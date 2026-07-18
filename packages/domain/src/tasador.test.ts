import { describe, expect, it } from 'vitest';
import { promedioUsdM2, superficieTotal, usdM2, valoresSugeridos } from './tasador';

describe('superficieTotal', () => {
  it('suma cubierta + semicubierta + 30% de descubierta', () => {
    expect(superficieTotal({ cubierta: 80, semicubierta: 10, descubierta: 20 })).toBeCloseTo(96);
  });

  it('es 0 si todas las superficies son 0', () => {
    expect(superficieTotal({ cubierta: 0, semicubierta: 0, descubierta: 0 })).toBe(0);
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
