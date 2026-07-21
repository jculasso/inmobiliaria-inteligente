import { describe, expect, it } from 'vitest';
import { agregar, ranking, type TasacionCalc } from './kpis.calc';

// Dataset fijo de tasaciones (ya filtradas por rango de fecha en el servicio).
//   A: 3 tasaciones → 2 Captada, 1 En proceso
//   B: 2 tasaciones → 1 Captada, 1 No captada
//   C: 1 tasación   → Presentada
const tasaciones: TasacionCalc[] = [
  { id: 't1', agenteId: 'a', nombre: 'A', estado: 'Captada' },
  { id: 't2', agenteId: 'a', nombre: 'A', estado: 'Captada' },
  { id: 't3', agenteId: 'a', nombre: 'A', estado: 'En proceso' },
  { id: 't4', agenteId: 'b', nombre: 'B', estado: 'Captada' },
  { id: 't5', agenteId: 'b', nombre: 'B', estado: 'No captada' },
  { id: 't6', agenteId: 'c', nombre: 'C', estado: 'Presentada' },
];

describe('agregar', () => {
  it('total, tasa de captación y distribución por estado sobre todo el alcance', () => {
    const r = agregar(tasaciones, null);
    expect(r.total).toBe(6);
    expect(r.tasaCaptacion).toBeCloseTo(3 / 6);
    expect(r.distribucionEstado).toEqual([
      { estado: 'En proceso', cantidad: 1 },
      { estado: 'Presentada', cantidad: 1 },
      { estado: 'Captada', cantidad: 3 },
      { estado: 'No captada', cantidad: 1 },
    ]);
  });

  it('acota por scope (solo las tasaciones del conjunto)', () => {
    const r = agregar(tasaciones, new Set(['a']));
    expect(r.total).toBe(3);
    expect(r.tasaCaptacion).toBeCloseTo(2 / 3);
  });

  it('tasa de captación 0 cuando no hay tasaciones', () => {
    expect(agregar([], null).tasaCaptacion).toBe(0);
    expect(agregar(tasaciones, new Set(['zzz'])).total).toBe(0);
  });
});

describe('ranking', () => {
  it('ordena por captadas desc, calcula peso relativo y excluye agentes sin ninguna captación', () => {
    const r = ranking(tasaciones, null);
    // 'c' no tiene captadas (solo una tasación "Presentada") y no debe aparecer.
    expect(r.map((x) => x.usuarioId)).toEqual(['a', 'b']);
    expect(r[0]).toMatchObject({ usuarioId: 'a', captadas: 2, total: 3 });
    expect(r[0]?.tasaCaptacion).toBeCloseTo(2 / 3);
    expect(r[0]?.peso).toBeCloseTo(2 / 3);
    expect(r[1]).toMatchObject({ usuarioId: 'b', captadas: 1, total: 2 });
    expect(r[1]?.peso).toBeCloseTo(1 / 3);
  });

  it('con scope de un agente solo aparece ese agente (peso 1)', () => {
    const r = ranking(tasaciones, new Set(['a']));
    expect(r).toHaveLength(1);
    expect(r[0]?.peso).toBeCloseTo(1);
  });
});
