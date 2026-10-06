import { describe, expect, it } from 'vitest';
import { escribirImporte, fmtVariacion, leerImporte, leerNumero, variacionEntre } from './importe';
import { fmtMoneda } from './format';

describe('leerImporte', () => {
  // El bug del alta de contrato: «200.000» se guardaba como 200.
  it('los puntos de miles son miles', () => {
    expect(leerImporte('200.000')).toBe(200_000);
    expect(leerImporte('1.500.000')).toBe(1_500_000);
    expect(leerImporte('200.000,50')).toBe(200_000.5);
    expect(leerImporte('$ 1.234.567,89')).toBe(1_234_567.89);
  });

  it('el punto decimal de un teclado en inglés no multiplica por cien', () => {
    expect(leerImporte('1500.50')).toBe(1500.5);
    expect(leerImporte('1500.5')).toBe(1500.5);
  });

  it('sin separadores, con coma decimal, vacío y basura', () => {
    expect(leerImporte('250000')).toBe(250_000);
    expect(leerImporte('18750,5')).toBe(18_750.5);
    expect(leerImporte('')).toBeNull();
    expect(leerImporte('abc')).toBeNaN();
  });

  it('lo que escribe el campo se vuelve a leer igual', () => {
    for (const n of [0, 0.5, 200_000, 471_207.03, 1_234_567.89]) expect(leerImporte(escribirImporte(n))).toBe(n);
  });
});

describe('leerNumero (porcentajes)', () => {
  it('el punto y la coma son decimales', () => {
    expect(leerNumero('8,5')).toBe(8.5);
    expect(leerNumero('0.125')).toBe(0.125);
  });
});

// Javier, 6/10/2026: «cuando da 200.000,00 los decimales no se muestran y queda mal».
describe('fmtMoneda', () => {
  it('siempre con centavos, en su moneda', () => {
    expect(fmtMoneda(200_000)).toBe('$ 200.000,00');
    expect(fmtMoneda(2_111_617.72)).toBe('$ 2.111.617,72');
    expect(fmtMoneda(1_500, 'USD')).toBe('U$S 1.500,00');
    expect(fmtMoneda(-50_000)).toBe('-$ 50.000,00');
    expect(fmtMoneda(-0.001)).toBe('$ 0,00');
  });
});

describe('fmtVariacion', () => {
  it('con signo y un decimal fijo, para que la columna quede alineada', () => {
    expect(fmtVariacion(1.94)).toBe('+1,9%');
    expect(fmtVariacion(10)).toBe('+10,0%');
    expect(fmtVariacion(-0.44)).toBe('-0,4%');
    expect(variacionEntre(100, 132.4)).toBe('+32,4%');
    expect(fmtVariacion(null)).toBe('—');
  });
});
