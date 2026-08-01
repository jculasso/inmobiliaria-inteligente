import { describe, expect, it } from 'vitest';
import { armarCsv, fechaCsv } from './csv';

/**
 * Toda la promesa de la exportación es que el dueño abra el archivo y lo
 * entienda. Estas tres cosas son las que hacen que Excel en español lo abra
 * bien; si alguna se rompe, el archivo llega ilegible y la promesa no se
 * cumplió.
 */
describe('armarCsv', () => {
  const cols = [
    { clave: 'nombre' as const, titulo: 'Nombre' },
    { clave: 'monto' as const, titulo: 'Monto' },
    { clave: 'activo' as const, titulo: 'Activo' },
  ];

  it('arranca con la marca de orden de bytes, o Excel rompe los acentos', () => {
    const csv = armarCsv(cols, [{ nombre: 'Nicolás Vera', monto: 1, activo: true }]);
    expect(csv.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(csv.toString('utf8')).toContain('Nicolás Vera');
  });

  it('separa con punto y coma: con comas, Excel en español mete todo en una columna', () => {
    const csv = armarCsv(cols, []).toString('utf8');
    expect(csv).toContain('Nombre;Monto;Activo');
  });

  it('usa coma decimal, o los importes se leen como texto', () => {
    const csv = armarCsv(cols, [{ nombre: 'x', monto: 1234.56, activo: false }]).toString('utf8');
    expect(csv).toContain('1234,56');
    expect(csv).not.toContain('1234.56');
  });

  it('encierra entre comillas solo cuando hace falta', () => {
    const csv = armarCsv(cols, [
      { nombre: 'Sin nada raro', monto: 1, activo: true },
      { nombre: 'Con; punto y coma', monto: 2, activo: false },
      { nombre: 'Con "comillas"', monto: 3, activo: true },
    ]).toString('utf8');
    expect(csv).toContain('Sin nada raro;');
    expect(csv).toContain('"Con; punto y coma"');
    expect(csv).toContain('"Con ""comillas"""');
  });

  it('los booleanos se leen en castellano', () => {
    const csv = armarCsv(cols, [{ nombre: 'x', monto: 0, activo: true }]).toString('utf8');
    expect(csv).toContain(';Sí');
  });

  it('los vacíos quedan vacíos, no dicen "null"', () => {
    const csv = armarCsv(cols, [{ nombre: null, monto: undefined, activo: null }]).toString('utf8');
    expect(csv).not.toMatch(/null|undefined/);
  });
});

describe('fechaCsv', () => {
  it('escribe dd/mm/aaaa, como el resto del producto', () => {
    expect(fechaCsv(new Date('2026-06-18T00:00:00Z'))).toBe('18/06/2026');
    expect(fechaCsv('2026-01-05')).toBe('05/01/2026');
    expect(fechaCsv(null)).toBe('');
  });
});
