import { describe, expect, it } from 'vitest';
import { compararOperaciones, numeroDeCodigo } from './tablero';

const op = (codigo: string, fechaFirma: string | null = null) => ({ codigo, fechaFirma });

/** Ordena como lo haría la tabla y devuelve solo los códigos. */
function ordenar(
  ops: { codigo: string; fechaFirma: string | null }[],
  orden: 'codigo' | 'fechaFirma' = 'codigo',
  dir: 'asc' | 'desc' = 'desc',
) {
  return [...ops].sort((a, b) => compararOperaciones(a, b, orden, dir)).map((o) => o.codigo);
}

describe('numeroDeCodigo', () => {
  it('extrae los dígitos, sin importar el prefijo', () => {
    expect(numeroDeCodigo('OP-1001')).toBe(1001);
    expect(numeroDeCodigo('ALQ-35')).toBe(35);
    // El prefijo no aporta dígitos aunque tenga varias partes.
    expect(numeroDeCodigo('SNS-OP-0100')).toBe(100);
  });

  it('ignora los ceros de relleno', () => {
    expect(numeroDeCodigo('OP-0086')).toBe(86);
  });

  it('devuelve null si no hay ningún dígito', () => {
    expect(numeroDeCodigo('SIN-NUMERO')).toBeNull();
    expect(numeroDeCodigo('')).toBeNull();
  });
});

describe('compararOperaciones — por código', () => {
  /**
   * El motivo de todo esto. Como texto, "OP-999" es MAYOR que "OP-1001"
   * porque se compara carácter por carácter y '9' > '1'.
   */
  it('999 va DESPUÉS de 1001, no antes', () => {
    expect(ordenar([op('OP-999'), op('OP-1001')])).toEqual(['OP-1001', 'OP-999']);
  });

  it('el relleno con ceros no cambia el resultado', () => {
    expect(ordenar([op('OP-0086'), op('OP-161953'), op('OP-0085')])).toEqual([
      'OP-161953',
      'OP-0086',
      'OP-0085',
    ]);
  });

  it('ascendente da exactamente la vuelta', () => {
    expect(ordenar([op('OP-999'), op('OP-1001')], 'codigo', 'asc')).toEqual([
      'OP-999',
      'OP-1001',
    ]);
  });

  it('los códigos sin número quedan al final en los DOS sentidos', () => {
    const ops = [op('SIN'), op('OP-5'), op('OP-9')];
    expect(ordenar(ops, 'codigo', 'desc')).toEqual(['OP-9', 'OP-5', 'SIN']);
    expect(ordenar(ops, 'codigo', 'asc')).toEqual(['OP-5', 'OP-9', 'SIN']);
  });
});

describe('compararOperaciones — por fecha de firma', () => {
  it('la más reciente arriba', () => {
    const ops = [op('A-1', '2026-01-05'), op('A-2', '2026-07-18'), op('A-3', '2026-03-02')];
    expect(ordenar(ops, 'fechaFirma', 'desc')).toEqual(['A-2', 'A-3', 'A-1']);
  });

  it('las que no tienen firma quedan al final, también en ascendente', () => {
    // Es el caso que se olvida: sin este cuidado, la pantalla abriría con un
    // bloque de guiones arriba de todo.
    const ops = [op('A-1', null), op('A-2', '2026-07-18'), op('A-3', '2026-01-05')];
    expect(ordenar(ops, 'fechaFirma', 'asc')).toEqual(['A-3', 'A-2', 'A-1']);
    expect(ordenar(ops, 'fechaFirma', 'desc')).toEqual(['A-2', 'A-3', 'A-1']);
  });

  it('desempata por código, para que el orden no cambie entre recargas', () => {
    // Tres firmadas el mismo día: sin desempate, el orden dependería del azar
    // y la lista parecería moverse sola.
    const ops = [op('A-3', '2026-06-30'), op('A-1', '2026-06-30'), op('A-2', '2026-06-30')];
    expect(ordenar(ops, 'fechaFirma', 'desc')).toEqual(ordenar(ops, 'fechaFirma', 'desc'));
    expect(new Set(ordenar(ops, 'fechaFirma', 'desc'))).toEqual(new Set(['A-1', 'A-2', 'A-3']));
  });
});
