import { describe, expect, it } from 'vitest';
import { fmtK, fmtNum, fmtUSD } from './format';

describe('fmtUSD', () => {
  it('redondea y agrega separador de miles es-AR con prefijo $', () => {
    expect(fmtUSD(45231.7)).toBe('$45.232');
  });

  it('trata null/undefined como 0', () => {
    expect(fmtUSD(null)).toBe('$0');
    expect(fmtUSD(undefined)).toBe('$0');
  });
});

describe('fmtNum', () => {
  it('redondea y agrega separador de miles es-AR sin prefijo', () => {
    expect(fmtNum(1234.4)).toBe('1.234');
  });
});

describe('fmtK', () => {
  it('abrevia miles con "k"', () => {
    expect(fmtK(45231)).toBe('45k');
  });

  it('abrevia millones con "M" y un decimal', () => {
    expect(fmtK(1250000)).toBe('1.3M');
  });

  it('no abrevia valores menores a mil', () => {
    expect(fmtK(500)).toBe('500');
  });
});
