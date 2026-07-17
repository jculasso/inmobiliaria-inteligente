import { describe, expect, it } from 'vitest';
import { agregar, ranking, seguimientoObjetivos, type ObjetivoRow, type PuntaCalc } from './kpis.calc';

// Dataset fijo de puntas escrituradas (ya filtrado por estado/año en el servicio).
//   OP1  precio 100  → A vendedora (com 3) + B compradora (com 2)
//   OP2  precio 200  → A vendedora (com 6)
//   OP3  precio  50  → C compradora (com 1.5)
const puntas: PuntaCalc[] = [
  { operacionId: 'op1', usuarioId: 'a', nombre: 'A', lado: 'vendedora', precio: 100, comision: 3 },
  { operacionId: 'op1', usuarioId: 'b', nombre: 'B', lado: 'compradora', precio: 100, comision: 2 },
  { operacionId: 'op2', usuarioId: 'a', nombre: 'A', lado: 'vendedora', precio: 200, comision: 6 },
  { operacionId: 'op3', usuarioId: 'c', nombre: 'C', lado: 'compradora', precio: 50, comision: 1.5 },
];

describe('agregar', () => {
  it('cada punta aporta el precio completo (volumen = Σ precio por punta)', () => {
    const a = agregar(puntas, null);
    expect(a.volumen).toBe(450); // 100 + 100 + 200 + 50
    expect(a.puntas).toBe(4);
    expect(a.operaciones).toBe(3);
    expect(a.puntasCompradoras).toBe(2);
    expect(a.puntasVendedoras).toBe(2);
    expect(a.comision).toBe(12.5);
    expect(a.ticketPromedio).toBe(112.5); // 450 / 4
  });

  it('acota por scope (solo las puntas del conjunto)', () => {
    const a = agregar(puntas, new Set(['a']));
    expect(a.volumen).toBe(300); // op1(100) + op2(200)
    expect(a.puntas).toBe(2);
    expect(a.operaciones).toBe(2);
    expect(a.puntasVendedoras).toBe(2);
    expect(a.puntasCompradoras).toBe(0);
    expect(a.comision).toBe(9);
    expect(a.ticketPromedio).toBe(150);
  });

  it('ticket 0 cuando no hay puntas', () => {
    expect(agregar([], null).ticketPromedio).toBe(0);
    expect(agregar(puntas, new Set(['zzz'])).volumen).toBe(0);
  });
});

describe('ranking', () => {
  it('ordena por volumen desc y calcula peso relativo', () => {
    const r = ranking(puntas, null);
    expect(r.map((x) => x.usuarioId)).toEqual(['a', 'b', 'c']);
    expect(r[0]).toMatchObject({ usuarioId: 'a', volumen: 300, puntas: 2, operaciones: 2, comision: 9 });
    expect(r[0]?.peso).toBeCloseTo(300 / 450);
    expect(r[1]).toMatchObject({ usuarioId: 'b', volumen: 100 });
    expect(r[2]).toMatchObject({ usuarioId: 'c', volumen: 50 });
    const sumaPeso = r.reduce((s, x) => s + x.peso, 0);
    expect(sumaPeso).toBeCloseTo(1);
  });

  it('con scope de un vendedor solo aparece ese vendedor (peso 1)', () => {
    const r = ranking(puntas, new Set(['a']));
    expect(r).toHaveLength(1);
    expect(r[0]?.peso).toBeCloseTo(1);
  });
});

describe('seguimientoObjetivos', () => {
  const objetivos: ObjetivoRow[] = [
    { usuarioId: 'a', nombre: 'A', objComision: 10, objVolumen: 500, objPuntas: 3 },
  ];

  it('compara real vs objetivo por vendedor', () => {
    const s = seguimientoObjetivos(puntas, objetivos, 2026, null);
    const a = s.find((x) => x.usuarioId === 'a');
    expect(a).toMatchObject({ realVolumen: 300, realPuntas: 2, realComision: 9 });
    expect(a?.avanceComision).toBeCloseTo(0.9);
    expect(a?.avanceVolumen).toBeCloseTo(0.6);
    expect(a?.avancePuntas).toBeCloseTo(2 / 3);
  });

  it('incluye vendedores con actividad aunque no tengan objetivo (avance 0)', () => {
    const s = seguimientoObjetivos(puntas, objetivos, 2026, null);
    const b = s.find((x) => x.usuarioId === 'b');
    expect(b).toBeDefined();
    expect(b?.objComision).toBe(0);
    expect(b?.avanceComision).toBe(0);
  });
});
