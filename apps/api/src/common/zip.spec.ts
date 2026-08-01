import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, crearZip } from './zip';

/** El CRC-32 tiene vectores de prueba conocidos: si estos dan, la tabla está bien. */
describe('crc32', () => {
  it('coincide con los valores de referencia', () => {
    expect(crc32(Buffer.from(''))).toBe(0);
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.from('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

/**
 * El ZIP se verifica con `unzip` de verdad, no comparando bytes contra lo que
 * yo mismo escribí. Un archivo binario que "parece bien" pero que el sistema
 * operativo no puede abrir es exactamente el error que este test tiene que
 * atrapar — y es el que nadie nota hasta que un cliente hace doble clic.
 */
describe('crearZip', () => {
  const archivos = [
    { nombre: 'operaciones.csv', contenido: Buffer.from('﻿código;monto\r\nALT-1;1234,56\r\n', 'utf8') },
    { nombre: 'vendedores.csv', contenido: Buffer.from('﻿nombre\r\nNicolás Vera\r\n', 'utf8') },
    { nombre: 'chico.txt', contenido: Buffer.from('x') },
  ];

  it('el sistema operativo lo abre y devuelve el contenido intacto', () => {
    const zip = crearZip(archivos, new Date('2026-08-01T10:30:00'));
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const ruta = join(dir, 'datos.zip');
    writeFileSync(ruta, zip);

    // -t verifica los CRC de todo el archivo; si algo está mal, tira distinto de 0.
    const prueba = execFileSync('unzip', ['-t', ruta], { encoding: 'utf8' });
    expect(prueba).toContain('No errors detected');

    execFileSync('unzip', ['-o', '-q', ruta, '-d', dir]);
    for (const a of archivos) {
      expect(readFileSync(join(dir, a.nombre))).toEqual(a.contenido);
    }
  });

  it('lista los tres archivos con sus nombres', () => {
    const zip = crearZip(archivos, new Date('2026-08-01T10:30:00'));
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const ruta = join(dir, 'datos.zip');
    writeFileSync(ruta, zip);

    const lista = execFileSync('unzip', ['-Z', '-1', ruta], { encoding: 'utf8' });
    expect(lista.trim().split('\n').sort()).toEqual(['chico.txt', 'operaciones.csv', 'vendedores.csv']);
  });

  // Mismo contenido y mismo momento tienen que dar el mismo archivo: si no, no
  // se puede afirmar nada en un test sobre el resultado.
  it('es reproducible', () => {
    const cuando = new Date('2026-08-01T10:30:00');
    expect(crearZip(archivos, cuando)).toEqual(crearZip(archivos, cuando));
  });

  it('un archivo vacío no lo rompe', () => {
    const zip = crearZip([{ nombre: 'vacio.csv', contenido: Buffer.alloc(0) }], new Date('2026-08-01T10:30:00'));
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    writeFileSync(join(dir, 'v.zip'), zip);
    expect(execFileSync('unzip', ['-t', join(dir, 'v.zip')], { encoding: 'utf8' })).toContain('No errors');
  });
});
