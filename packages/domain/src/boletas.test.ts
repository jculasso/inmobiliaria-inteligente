import { describe, expect, it } from 'vitest';
import { agruparPorUrgencia, type BoletaParaAgrupar } from './boletas';

const HOY = '2026-10-07';
const b = (
  id: string,
  vencimiento: string,
  estado: BoletaParaAgrupar['estado'] = 'pendiente',
  periodo = vencimiento.slice(0, 7),
): BoletaParaAgrupar => ({ id, vencimiento, estado, periodo });
const ids = (xs: BoletaParaAgrupar[]) => xs.map((x) => x.id);

describe('regla 48: «Para pagar» por urgencia', () => {
  it('regla 48: vencidas de cualquier mes, esta semana (hoy a 7 días), más adelante del mes, pagadas y anuladas del mes', () => {
    const g = agruparPorUrgencia(
      [
        b('agosto', '2026-08-20'),
        b('ayer', '2026-10-06'),
        b('hoy', '2026-10-07'),
        b('en7', '2026-10-14'),
        b('en8', '2026-10-15'),
        b('fin', '2026-10-31'),
        b('noviembre', '2026-11-20'),
        b('pagada', '2026-10-10', 'pagada'),
        b('anulada', '2026-10-10', 'anulada'),
        b('pagadaSept', '2026-09-10', 'pagada'),
      ],
      HOY,
      '2026-10',
    );
    expect(ids(g.vencidas)).toEqual(['agosto', 'ayer']);
    expect(ids(g.semana)).toEqual(['hoy', 'en7']);
    expect(ids(g.masAdelante)).toEqual(['en8', 'fin']);
    expect(ids(g.pagadas)).toEqual(['pagada']);
    expect(ids(g.anuladas)).toEqual(['anulada']);
  });

  it('regla 48: la misma boleta en las dos listas que se piden queda en un solo grupo', () => {
    const repetida = b('x', '2026-10-06');
    const g = agruparPorUrgencia([repetida, { ...repetida }], HOY, '2026-10');
    expect(ids(g.vencidas)).toEqual(['x']);
    expect([...g.semana, ...g.masAdelante, ...g.pagadas, ...g.anuladas]).toEqual([]);
  });

  it('regla 48: una del mes siguiente que vence esta semana va a «Esta semana» aunque se mire otro mes', () => {
    const g = agruparPorUrgencia(
      [b('cuota', '2026-10-12', 'pendiente', '2026-11')],
      HOY,
      '2026-09',
    );
    expect(ids(g.semana)).toEqual(['cuota']);
  });

  it('regla 48: dentro de cada grupo, por vencimiento', () => {
    const g = agruparPorUrgencia(
      [b('c', '2026-10-05'), b('a', '2026-09-01'), b('b', '2026-10-01')],
      HOY,
      '2026-10',
    );
    expect(ids(g.vencidas)).toEqual(['a', 'b', 'c']);
  });
});
