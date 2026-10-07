import { describe, expect, it } from 'vitest';
import {
  cantidad,
  fmtFecha,
  fmtFechaDe,
  fmtFechaHora,
  fmtK,
  fmtNum,
  fmtUSD,
  nroDocumento,
} from './format';

describe('fmtUSD', () => {
  it('redondea y agrega separador de miles es-AR con prefijo $', () => {
    expect(fmtUSD(45231.7)).toBe('U$S 45.232');
  });

  it('trata null/undefined como 0', () => {
    expect(fmtUSD(null)).toBe('U$S 0');
    expect(fmtUSD(undefined)).toBe('U$S 0');
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

/**
 * Los momentos (cuándo se registró algo) vienen en UTC. Después de las 21 h
 * de Argentina, la parte de la fecha en UTC ya es mañana: un reclamo abierto
 * el 6 a la noche aparecía «abierto el 7».
 */
describe('fmtFechaDe y fmtFechaHora', () => {
  it('a las 23:30 de Argentina sigue siendo el mismo día', () => {
    expect(fmtFechaDe('2026-10-07T02:30:00.000Z')).toBe('06/10/2026');
    expect(fmtFechaHora('2026-10-07T02:30:00.000Z')).toBe('06/10/2026 23:30');
  });

  it('un día calendario suelto no se corre', () => {
    expect(fmtFechaDe('2026-01-01')).toBe('01/01/2026');
  });

  it('vacío es una raya', () => {
    expect(fmtFechaDe(null)).toBe('—');
    expect(fmtFechaHora(undefined)).toBe('—');
  });
});

describe('cantidad', () => {
  it('singular con uno, plural con el resto', () => {
    expect(cantidad(1, 'boleta')).toBe('1 boleta');
    expect(cantidad(3, 'boleta')).toBe('3 boletas');
    expect(cantidad(0, 'día')).toBe('0 días');
    expect(cantidad(1, 'mes', 'meses')).toBe('1 mes');
    expect(cantidad(2, 'mes', 'meses')).toBe('2 meses');
    expect(cantidad(1500, 'concepto')).toBe('1.500 conceptos');
  });
});

describe('nroDocumento', () => {
  it('seis cifras, como en el PDF', () => {
    expect(nroDocumento(27)).toBe('000027');
    expect(nroDocumento(1234567)).toBe('1234567');
  });
});
