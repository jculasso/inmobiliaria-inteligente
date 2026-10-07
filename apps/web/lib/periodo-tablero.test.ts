import { describe, expect, it } from 'vitest';
import {
  leerPeriodo,
  mesesDelPeriodo,
  nombreDelPeriodo,
  parametrosDelPeriodo,
  periodoPorDefecto,
  rangoDelPeriodo,
  type PeriodoTablero,
} from './periodo-tablero';

const HOY = '2026-10-20';

// Regla 74: el período del Dashboard de Alquileres, en la dirección.
describe('periodo-tablero', () => {
  it('al entrar, el mes en curso; en un año pasado, diciembre', () => {
    expect(periodoPorDefecto(HOY, 2026)).toEqual({ por: 'mes', mes: 10 });
    expect(periodoPorDefecto(HOY, 2025)).toEqual({ por: 'mes', mes: 12 });
    expect(leerPeriodo({}, HOY, 2026)).toEqual({ por: 'mes', mes: 10 });
  });

  it('lo que se escribe en la dirección se vuelve a leer igual', () => {
    const periodos: PeriodoTablero[] = [
      { por: 'mes', mes: 3 },
      { por: 'mes', mes: 10 },
      { por: 'trimestre', q: 1 },
      { por: 'trimestre', q: 4 },
      { por: 'anio' },
    ];
    for (const p of periodos) {
      const params = Object.fromEntries(parametrosDelPeriodo(p, HOY, 2026));
      expect(leerPeriodo(params, HOY, 2026)).toEqual(p);
    }
  });

  it('el período por defecto no escribe nada; los demás, lo justo', () => {
    expect(parametrosDelPeriodo({ por: 'mes', mes: 10 }, HOY, 2026)).toEqual([]);
    expect(parametrosDelPeriodo({ por: 'mes', mes: 3 }, HOY, 2026)).toEqual([
      ['periodo', 'mes'],
      ['mes', '3'],
    ]);
    expect(parametrosDelPeriodo({ por: 'trimestre', q: 3 }, HOY, 2026)).toEqual([
      ['periodo', 'trimestre'],
      ['q', '3'],
    ]);
    expect(parametrosDelPeriodo({ por: 'anio' }, HOY, 2026)).toEqual([['periodo', 'anio']]);
  });

  it('una dirección tocada a mano no rompe: vuelve a lo de por defecto', () => {
    expect(leerPeriodo({ periodo: 'mes', mes: '13' }, HOY, 2026)).toEqual({ por: 'mes', mes: 10 });
    expect(leerPeriodo({ periodo: 'trimestre', q: 'x' }, HOY, 2026)).toEqual({
      por: 'trimestre',
      q: 4,
    });
    expect(leerPeriodo({ periodo: 'semana' }, HOY, 2026)).toEqual({ por: 'mes', mes: 10 });
  });

  it('los meses, el rango y el nombre de cada período', () => {
    expect(mesesDelPeriodo({ por: 'trimestre', q: 2 })).toEqual([4, 5, 6]);
    expect(mesesDelPeriodo({ por: 'anio' })).toHaveLength(12);
    expect(rangoDelPeriodo({ por: 'trimestre', q: 1 }, 2026)).toEqual({
      desde: '2026-01',
      hasta: '2026-03',
    });
    expect(rangoDelPeriodo({ por: 'mes', mes: 10 }, 2026)).toEqual({
      desde: '2026-10',
      hasta: '2026-10',
    });
    expect(nombreDelPeriodo({ por: 'mes', mes: 10 }, 2026)).toBe('octubre 2026');
    expect(nombreDelPeriodo({ por: 'trimestre', q: 3 }, 2026)).toBe('Q3 2026');
    expect(nombreDelPeriodo({ por: 'anio' }, 2026)).toBe('2026');
  });
});
