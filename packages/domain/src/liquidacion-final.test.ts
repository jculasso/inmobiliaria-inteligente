import { describe, expect, it } from 'vitest';
import {
  generarPeriodo,
  parteDeClave,
  proponerLiquidacion,
  proponerPunitorio,
  type ContratoParaGenerar,
} from './alquileres';
import {
  claveFinal,
  claveParcialDeFinal,
  diferenciasDeLiquidacionFinal,
  generarPeriodoConParciales,
  resumenDeDiferencias,
  vencimientoDeLaDiferencia,
  type ConceptoConEtapa,
  type ConceptoDeLaEtapa,
  type DiferenciaFinal,
} from './liquidacion-final';

/*
 * Florencia (Vacker), 15/10/2026: el IPC sale atrasado; se cobra una
 * liquidación parcial con el importe del mes pasado y, cuando sale el índice,
 * la final con la diferencia, en el mismo mes.
 *
 * El contrato de prueba es como ALT-0005 de Alteva —IPC cada 3 meses, el
 * tramo de octubre espera el IPC de septiembre— pero con DOS dueños al 50% y
 * un importe impar, para que el reparto y el IVA dejen centavos.
 */
const DUENO_A = 'dueno-a';
const DUENO_B = 'dueno-b';
const INQ = 'inq';
const ANTERIOR = 645_321;
const DEFINITIVO = 701_237;

function alt5(importeTramo3: number | null): ContratoParaGenerar {
  return {
    id: 'c5',
    moneda: 'ARS',
    inicio: '2026-04-01',
    fin: '2028-03-31',
    rescindidoEl: null,
    diaVencimiento: 5,
    diaPagoPropietario: 10,
    honorariosPct: 8,
    gastosAdmPct: 2,
    ivaPct: 0,
    tramos: [
      { numero: 2, desde: '2026-07-01', hasta: '2026-09-30', importe: ANTERIOR },
      { numero: 3, desde: '2026-10-01', hasta: '2026-12-31', importe: importeTramo3 },
      { numero: 4, desde: '2027-01-01', hasta: '2027-03-31', importe: null },
    ],
    propietarios: [
      { personaId: DUENO_A, porcentaje: 50 },
      { personaId: DUENO_B, porcentaje: 50 },
    ],
    inquilinos: [{ personaId: INQ }],
  };
}

const ESPERA = new Map([
  [3, { importeProvisorio: ANTERIOR, espera: 'el IPC de septiembre de 2026' }],
]);

/** Lo generado como parcial, como lo devolvería la base para calcular la final. */
const existentes = (ks: ConceptoConEtapa[], anuladas: string[] = []): ConceptoDeLaEtapa[] =>
  ks
    .filter((k) => k.etapa)
    .map((k) => ({
      clave: k.clave,
      sentido: k.sentido,
      importe: k.importe,
      etapa: k.etapa!,
      anulado: anuladas.includes(k.clave),
    }));

const centavos = (n: number) => Math.round(n * 100);

/** Suma, por concepto definitivo, parcial + finales (con signo): tiene que dar el definitivo. */
function sumaPorConcepto(parciales: ConceptoConEtapa[], finales: DiferenciaFinal[]) {
  const suma = new Map<string, number>();
  for (const k of parciales) suma.set(k.clave, centavos(k.importe));
  for (const f of finales) {
    const base = claveParcialDeFinal(f.clave)!;
    suma.set(base, (suma.get(base) ?? 0) + f.signo * centavos(f.importe));
  }
  return new Map([...suma].map(([k, v]) => [k, v / 100]));
}

describe('generarPeriodoConParciales (regla 130)', () => {
  it('regla 130: el mes que espera el IPC se genera con el importe del tramo anterior, marcado como parcial', () => {
    const r = generarPeriodoConParciales(alt5(null), '2026-10', 21, ESPERA);
    expect(r.sinIndexar).toEqual([]);
    expect(r.parciales).toEqual([
      expect.objectContaining({
        tramo: 3,
        desde: '2026-10-01',
        hasta: '2026-10-31',
        espera: 'el IPC de septiembre de 2026',
      }),
    ]);
    expect(r.conceptos.map((k) => [k.tipo, k.sentido, k.personaId, k.importe, k.etapa])).toEqual([
      ['alquiler', 'a_cobrar', INQ, ANTERIOR, 'parcial'],
      ['gastos_adm', 'a_cobrar', INQ, 15_616.77, 'parcial'],
      ['alquiler', 'a_pagar', DUENO_A, 322_660.5, 'parcial'],
      ['honorarios', 'a_cobrar', DUENO_A, 31_233.54, 'parcial'],
      ['alquiler', 'a_pagar', DUENO_B, 322_660.5, 'parcial'],
      ['honorarios', 'a_cobrar', DUENO_B, 31_233.54, 'parcial'],
    ]);
    expect(r.conceptos.every((k) => k.tramo === 3)).toBe(true);
    expect(r.conceptos[0]!.descripcion).toBe(
      'Alquiler octubre 2026 — liquidación parcial (espera el IPC de septiembre de 2026)',
    );
    // Los mismos importes y las mismas claves que un mes normal con el importe
    // anterior: generar de nuevo después de confirmar no duplica (regla 10).
    const comoSiFueraNormal = generarPeriodo(alt5(ANTERIOR), '2026-10', 21).conceptos;
    expect(r.conceptos.map((k) => [k.clave, k.importe])).toEqual(
      comoSiFueraNormal.map((k) => [k.clave, k.importe]),
    );
  });

  it('regla 130: un tramo sin importe que NO espera el índice sigue sin generarse (regla 11)', () => {
    const r = generarPeriodoConParciales(alt5(null), '2026-10', 21, new Map());
    expect(r.conceptos).toEqual([]);
    expect(r.parciales).toEqual([]);
    expect(r.sinIndexar.map((p) => p.tramo)).toEqual([3]);
  });

  it('regla 130: un mes partido genera la parte indexada normal y solo la otra como parcial, prorrateada', () => {
    // Como el contrato #5 de Gexion: el tramo cambia el 15 de diciembre.
    const c: ContratoParaGenerar = {
      ...alt5(null),
      propietarios: [{ personaId: DUENO_A, porcentaje: 100 }],
      tramos: [
        { numero: 4, desde: '2026-08-15', hasta: '2026-12-14', importe: 1_137_518 },
        { numero: 5, desde: '2026-12-15', hasta: '2027-04-14', importe: null },
      ],
    };
    const r = generarPeriodoConParciales(
      c,
      '2026-12',
      21,
      new Map([[5, { importeProvisorio: 1_137_518, espera: 'el IPC de noviembre de 2026' }]]),
    );
    const alquileres = r.conceptos.filter((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar');
    expect(alquileres.map((k) => [k.importe, k.etapa, k.tramo])).toEqual([
      [513_717.81, null, null],
      [623_800.19, 'parcial', 5], // 1.137.518 × 17/31
    ]);
    expect(alquileres[1]!.descripcion).toBe(
      'Alquiler 15/12 al 31/12/2026 (17/31 días) — liquidación parcial (espera el IPC de noviembre de 2026)',
    );
  });
});

describe('diferenciasDeLiquidacionFinal (reglas 131 a 134)', () => {
  const parcialOct = generarPeriodoConParciales(alt5(null), '2026-10', 21, ESPERA).conceptos;
  const parcialNov = generarPeriodoConParciales(alt5(null), '2026-11', 21, ESPERA).conceptos;
  const finales = (
    importe: number,
    ks = [...parcialOct, ...parcialNov],
    extra: ConceptoDeLaEtapa[] = [],
  ) =>
    diferenciasDeLiquidacionFinal({
      contrato: alt5(importe),
      tramo: 3,
      ivaInmobiliariaPct: 21,
      existentes: [...existentes(ks), ...extra],
      vencimiento: '2026-10-20',
      indice: 'IPC',
    });

  it('regla 131: una diferencia por cada concepto de cada mes generado como parcial, en ese mismo mes', () => {
    const ds = finales(DEFINITIVO);
    expect(ds.map((d) => [d.periodo, d.tipo, d.sentido, d.personaId, d.importe])).toEqual([
      ['2026-10', 'alquiler', 'a_cobrar', INQ, 55_916],
      ['2026-10', 'gastos_adm', 'a_cobrar', INQ, 1_353.17],
      ['2026-10', 'alquiler', 'a_pagar', DUENO_A, 27_958],
      ['2026-10', 'honorarios', 'a_cobrar', DUENO_A, 2_706.33],
      ['2026-10', 'alquiler', 'a_pagar', DUENO_B, 27_958],
      ['2026-10', 'honorarios', 'a_cobrar', DUENO_B, 2_706.33],
      ['2026-11', 'alquiler', 'a_cobrar', INQ, 55_916],
      ['2026-11', 'gastos_adm', 'a_cobrar', INQ, 1_353.17],
      ['2026-11', 'alquiler', 'a_pagar', DUENO_A, 27_958],
      ['2026-11', 'honorarios', 'a_cobrar', DUENO_A, 2_706.33],
      ['2026-11', 'alquiler', 'a_pagar', DUENO_B, 27_958],
      ['2026-11', 'honorarios', 'a_cobrar', DUENO_B, 2_706.33],
    ]);
    expect(ds.every((d) => d.etapa === 'final' && d.tramo === 3)).toBe(true);
    expect(ds[0]!.descripcion).toBe(
      'Alquiler octubre 2026 — liquidación final (diferencia por IPC)',
    );
    expect(ds[0]!.clave).toBe(claveFinal(parcialOct[0]!.clave, 1));
    // Diciembre no se generó como parcial: no tiene diferencia (se genera normal).
    expect(ds.some((d) => d.periodo === '2026-12')).toBe(false);
  });

  it('regla 132: parcial + final = definitivo al centavo, para inquilino, dos dueños al 50%, honorarios y gastos', () => {
    // Importes que dejan centavos en el reparto y en el IVA de cada lado.
    for (const definitivo of [DEFINITIVO, 701_238, 645_322, 999_999, 645_320]) {
      const ds = finales(definitivo);
      const suma = sumaPorConcepto([...parcialOct, ...parcialNov], ds);
      const esperado = [
        ...generarPeriodo(alt5(definitivo), '2026-10', 21).conceptos,
        ...generarPeriodo(alt5(definitivo), '2026-11', 21).conceptos,
      ];
      expect(esperado).toHaveLength(12);
      for (const k of esperado) expect([k.clave, suma.get(k.clave)]).toEqual([k.clave, k.importe]);
    }
  });

  it('regla 132: con el mes partido, la parte prorrateada también cierra al centavo', () => {
    const c = (importe: number | null): ContratoParaGenerar => ({
      ...alt5(null),
      tramos: [
        { numero: 4, desde: '2026-08-15', hasta: '2026-12-14', importe: 1_137_518 },
        { numero: 5, desde: '2026-12-15', hasta: '2027-04-14', importe },
      ],
    });
    const parcial = generarPeriodoConParciales(
      c(null),
      '2026-12',
      21,
      new Map([[5, { importeProvisorio: 1_137_518, espera: 'el IPC de noviembre de 2026' }]]),
    ).conceptos;
    const ds = diferenciasDeLiquidacionFinal({
      contrato: c(1_234_567),
      tramo: 5,
      ivaInmobiliariaPct: 21,
      existentes: existentes(parcial),
      vencimiento: '2026-12-21',
      indice: 'IPC',
    });
    const suma = sumaPorConcepto(
      parcial.filter((k) => k.etapa),
      ds,
    );
    const definitivo = generarPeriodo(c(1_234_567), '2026-12', 21).conceptos.filter((k) =>
      k.clave.includes('|2026-12-15|'),
    );
    expect(definitivo.length).toBeGreaterThan(0);
    for (const k of definitivo) expect(suma.get(k.clave)).toBe(k.importe);
    // La parte del 1 al 14 ya era definitiva: no tiene diferencia.
    expect(ds.every((d) => d.clave.includes('|2026-12-15~final|'))).toBe(true);
  });

  it('regla 134: si el definitivo es menor, el espejo: reintegro a favor del inquilino y a devolver por el dueño', () => {
    const ds = finales(640_000).filter((d) => d.periodo === '2026-10');
    expect(ds.map((d) => [d.tipo, d.sentido, d.personaId, d.importe, d.signo])).toEqual([
      ['otro', 'a_pagar', INQ, 5_321, -1],
      ['otro', 'a_pagar', INQ, 128.77, -1],
      ['otro', 'a_cobrar', DUENO_A, 2_660.5, -1],
      ['otro', 'a_pagar', DUENO_A, 257.54, -1],
      ['otro', 'a_cobrar', DUENO_B, 2_660.5, -1],
      ['otro', 'a_pagar', DUENO_B, 257.54, -1],
    ]);
    expect(ds[0]!.descripcion).toBe(
      'Alquiler octubre 2026 — liquidación final (diferencia por IPC, a su favor)',
    );
    expect(ds[2]!.descripcion).toBe(
      'Alquiler octubre 2026 — liquidación final (diferencia por IPC, a devolver)',
    );
    const suma = sumaPorConcepto(parcialOct, ds);
    for (const k of generarPeriodo(alt5(640_000), '2026-10', 21).conceptos)
      expect(suma.get(k.clave)).toBe(k.importe);
  });

  it('regla 131: si el definitivo es igual al anterior, no hay nada que generar', () => {
    expect(finales(ANTERIOR)).toEqual([]);
  });

  it('regla 135: una parcial anulada no recibe final; las demás sí', () => {
    const inquilino = parcialOct.find((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar')!;
    const ds = diferenciasDeLiquidacionFinal({
      contrato: alt5(DEFINITIVO),
      tramo: 3,
      ivaInmobiliariaPct: 21,
      existentes: existentes(parcialOct, [inquilino.clave]),
      vencimiento: '2026-10-20',
      indice: 'IPC',
    });
    expect(ds.some((d) => claveParcialDeFinal(d.clave) === inquilino.clave)).toBe(false);
    expect(ds).toHaveLength(5);
  });

  it('regla 135: si el importe se corrige después, la nueva diferencia es otra final y descuenta la anterior', () => {
    const primera = finales(DEFINITIVO, parcialOct);
    const yaGeneradas: ConceptoDeLaEtapa[] = primera.map((d) => ({
      clave: d.clave,
      sentido: d.sentido,
      importe: d.importe,
      etapa: 'final',
      anulado: false,
    }));
    const segunda = finales(690_000, parcialOct, yaGeneradas);
    expect(segunda[0]!.clave).toBe(claveFinal(parcialOct[0]!.clave, 2));
    expect(segunda[0]!.clave).toContain('|2026-10-01~final2|');
    const suma = sumaPorConcepto(parcialOct, [...primera, ...segunda]);
    for (const k of generarPeriodo(alt5(690_000), '2026-10', 21).conceptos)
      expect(suma.get(k.clave)).toBe(k.importe);
  });

  it('regla 136: la final es una parte propia del mes: el dueño cobra la parcial y la final espera a que el inquilino pague la diferencia', () => {
    const ds = finales(DEFINITIVO, parcialOct);
    const inqParcial = parcialOct.find((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar')!;
    const inqFinal = ds.find((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar')!;
    expect(parteDeClave(inqFinal.clave)).not.toBe(parteDeClave(inqParcial.clave));
    // El inquilino pagó la parcial entera y nada de la final.
    const cobrado = new Map([
      [`${parteDeClave(inqParcial.clave)}#alquiler`, 1],
      [`${parteDeClave(inqFinal.clave)}#alquiler`, 0],
    ]);
    const delDueno = [...parcialOct, ...ds]
      .filter((k) => k.personaId === DUENO_A)
      .map((k, i) => ({
        id: `k${i}`,
        tipo: k.tipo,
        sentido: k.sentido,
        saldo: k.importe,
        clave: k.clave,
        pagoGarantizado: false,
      }));
    const p = proponerLiquidacion(delDueno, cobrado);
    // Se le paga la parcial menos sus honorarios; la final y sus honorarios esperan.
    expect(p.neto).toBe(322_660.5 - 31_233.54);
    expect(p.enEspera.map((k) => [k.tipo, k.saldo])).toEqual([
      ['alquiler', 27_958],
      ['honorarios', 2_706.33],
    ]);
    // Cuando el inquilino paga la diferencia, se libera el complemento.
    cobrado.set(`${parteDeClave(inqFinal.clave)}#alquiler`, 1);
    const despues = proponerLiquidacion(delDueno, cobrado);
    expect(despues.enEspera).toEqual([]);
    expect(despues.neto).toBe(322_660.5 + 27_958 - 31_233.54 - 2_706.33);
  });
});

describe('resumenDeDiferencias (regla 137)', () => {
  it('regla 137: lo que paga de más el inquilino y lo que reciben de más los dueños, neto de honorarios', () => {
    const parcial = generarPeriodoConParciales(alt5(null), '2026-10', 21, ESPERA).conceptos;
    const ds = diferenciasDeLiquidacionFinal({
      contrato: alt5(DEFINITIVO),
      tramo: 3,
      ivaInmobiliariaPct: 21,
      existentes: existentes(parcial),
      vencimiento: '2026-10-20',
      indice: 'IPC',
    });
    expect(resumenDeDiferencias(ds)).toEqual({
      periodos: ['2026-10'],
      inquilino: 55_916 + 1_353.17,
      propietarios: 2 * (27_958 - 2_706.33),
    });
    const negativo = diferenciasDeLiquidacionFinal({
      contrato: alt5(640_000),
      tramo: 3,
      ivaInmobiliariaPct: 21,
      existentes: existentes(parcial),
      vencimiento: '2026-10-20',
      indice: 'IPC',
    });
    expect(resumenDeDiferencias(negativo)).toEqual({
      periodos: ['2026-10'],
      inquilino: -(5_321 + 128.77),
      propietarios: -2 * (2_660.5 - 257.54),
    });
  });
});

describe('vencimientoDeLaDiferencia (regla 133)', () => {
  it('regla 133: la fecha de confirmación más los días configurados, corrida al lunes si cae en fin de semana', () => {
    // Jueves 15/10/2026 + 5 = martes 20/10.
    expect(vencimientoDeLaDiferencia('2026-10-15', 5)).toBe('2026-10-20');
    // Lunes 12/10/2026 + 5 = sábado 17/10 → lunes 19/10.
    expect(vencimientoDeLaDiferencia('2026-10-12', 5)).toBe('2026-10-19');
    // Cruza el mes: viernes 30/10 + 1 = sábado 31/10 → lunes 2/11.
    expect(vencimientoDeLaDiferencia('2026-10-30', 1)).toBe('2026-11-02');
  });

  it('regla 133: antes de ese vencimiento la diferencia no tiene punitorio; después, sí', () => {
    const vence = vencimientoDeLaDiferencia('2026-10-15', 5);
    expect(proponerPunitorio(55_916, vence, '2026-10-20', 0.1).importe).toBe(0);
    expect(proponerPunitorio(55_916, vence, '2026-10-23', 0.1)).toEqual({
      dias: 3,
      importe: 167.75,
    });
  });
});
