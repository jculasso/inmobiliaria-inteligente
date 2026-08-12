import { describe, expect, it } from 'vitest';
import { fmtFecha, fmtK, fmtNum, fmtUSD } from './format';

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

/**
 * Las fechas del Tasador son días de calendario, no instantes. Formatearlas con
 * `new Date(iso)` las interpreta en UTC y en Argentina las corre un día para
 * atrás: una tasación del 7 aparecía como del 6.
 */
describe('fmtFecha', () => {
  it('da día/mes/año', () => {
    expect(fmtFecha('2026-08-07')).toBe('07/08/2026');
  });

  it('no corre el día por zona horaria', () => {
    // Con `new Date('2026-01-01').getDate()` en Argentina esto daba 31/12/2025.
    expect(fmtFecha('2026-01-01')).toBe('01/01/2026');
  });

  it('tolera una fecha con hora y una vacía', () => {
    expect(fmtFecha('2026-08-07T00:00:00.000Z')).toBe('07/08/2026');
    expect(fmtFecha(null)).toBe('—');
  });
});
