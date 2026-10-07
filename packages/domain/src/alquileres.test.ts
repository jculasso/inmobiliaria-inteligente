import { describe, expect, it } from 'vitest';
import {
  alertaIndice,
  alquilerDeHoy,
  proximoCambio,
  enLetras,
  importeEnLetras,
  cargoConIva,
  estadoDeFirma,
  fechaDelIndice,
  generarPeriodo,
  generarTramos,
  importeIndexado,
  parteDeClave,
  partesDelMes,
  planificarCobro,
  proponerLiquidacion,
  proponerPunitorio,
  proponerIndexacion,
  redondear2,
  repartir,
  sumarMesesIso,
  tramoDeMora,
  validarPartes,
  validarTramos,
  vencimientoDelMes,
  type ContratoParaGenerar,
} from './alquileres';

/*
 * Los números de estos tests salen de Gexion, el sistema que Vacker usa hoy,
 * relevados el 5/10/2026 sobre contratos reales (sin nombres ni direcciones).
 * El criterio de aceptación del módulo es dar lo mismo que Gexion al peso: si
 * uno de estos falla, el módulo y Gexion se contradicen.
 */

describe('generarTramos (regla 1)', () => {
  // Contrato #25 de Gexion: 01/11/2024 al 31/10/2026, tramos de 4 meses.
  it('contrato que arranca el 1: tramos de mes entero', () => {
    const t = generarTramos('2024-11-01', '2026-10-31', 4);
    expect(t).toHaveLength(6);
    expect(t[0]).toEqual({ numero: 1, desde: '2024-11-01', hasta: '2025-02-28' });
    expect(t[1]).toEqual({ numero: 2, desde: '2025-03-01', hasta: '2025-06-30' });
    expect(t[5]).toEqual({ numero: 6, desde: '2026-07-01', hasta: '2026-10-31' });
  });

  // Contrato #5: arranca el 15/08/2025, tramos del 15 al 14.
  it('contrato que arranca el 15: tramos del 15 al 14', () => {
    const t = generarTramos('2025-08-15', '2027-08-14', 4);
    expect(t[0]).toEqual({ numero: 1, desde: '2025-08-15', hasta: '2025-12-14' });
    expect(t[3]).toEqual({ numero: 4, desde: '2026-08-15', hasta: '2026-12-14' });
    expect(t.at(-1)!.hasta).toBe('2027-08-14');
  });

  it('el último tramo se corta en el fin del contrato', () => {
    const t = generarTramos('2026-07-01', '2026-11-30', 4);
    expect(t.map((x) => [x.desde, x.hasta])).toEqual([
      ['2026-07-01', '2026-10-31'],
      ['2026-11-01', '2026-11-30'],
    ]);
  });

  it('lo que genera siempre pasa la validación', () => {
    for (const [i, f, p] of [
      ['2025-01-31', '2027-01-30', 3],
      ['2024-02-29', '2026-02-28', 6],
      ['2026-03-15', '2029-03-14', 4],
    ] as const) {
      expect(validarTramos(i, f, generarTramos(i, f, p))).toEqual([]);
    }
  });

  it('un 31 sumado un mes cae en el último día del mes siguiente', () => {
    expect(sumarMesesIso('2025-01-31', 1)).toBe('2025-02-28');
    expect(sumarMesesIso('2024-01-31', 1)).toBe('2024-02-29');
  });
});

describe('validarTramos (regla 1)', () => {
  const base = [
    { numero: 1, desde: '2026-01-01', hasta: '2026-04-30' },
    { numero: 2, desde: '2026-05-01', hasta: '2026-08-31' },
  ];

  it('tramos de punta a punta: sin errores', () => {
    expect(validarTramos('2026-01-01', '2026-08-31', base)).toEqual([]);
  });

  it('un hueco se nombra con sus fechas', () => {
    const t = [base[0]!, { ...base[1]!, desde: '2026-05-15' }];
    expect(validarTramos('2026-01-01', '2026-08-31', t)).toEqual([
      'Del 01/05/2026 al 14/05/2026 no hay tramo.',
    ]);
  });

  it('una superposición se nombra con los tramos', () => {
    const t = [base[0]!, { ...base[1]!, desde: '2026-04-20' }];
    expect(validarTramos('2026-01-01', '2026-08-31', t)).toEqual([
      'Los tramos 1 y 2 se superponen desde el 20/04/2026.',
    ]);
  });

  it('falta cubrir el final del contrato', () => {
    expect(validarTramos('2026-01-01', '2026-12-31', base)).toEqual([
      'Del 01/09/2026 al 31/12/2026 no hay tramo.',
    ]);
  });

  it('sin tramos', () => {
    expect(validarTramos('2026-01-01', '2026-12-31', [])).toEqual(['El contrato no tiene tramos.']);
  });
});

describe('importeIndexado (regla 5)', () => {
  /*
   * Contrato #25 (ICL), con los valores oficiales del BCRA: 250.000 desde el
   * 01/11/2024 (ICL 19,89), y cada tramo encadenado sobre el anterior.
   * Gexion muestra 287.079, 327.175 y 355.833.
   */
  it('encadena sobre el tramo anterior: contrato #25 por ICL', () => {
    const t2 = importeIndexado(250_000, 19.89, 22.84);
    const t3 = importeIndexado(t2, 22.84, 26.03);
    const t4 = importeIndexado(t3, 26.03, 28.31);
    expect([t2, t3, t4]).toEqual([287_079, 327_175, 355_833]);
  });

  /*
   * Contrato #5 (IPC), arranca el 15/08/2025: el IPC de julio, noviembre,
   * marzo y julio. Gexion muestra 926.992, 1.043.387 y 1.137.518.
   */
  it('encadena sobre el tramo anterior: contrato #5 por IPC', () => {
    const t2 = importeIndexado(850_000, 9_023.973, 9_841.3581);
    const t3 = importeIndexado(t2, 9_841.3581, 11_077.0608);
    const t4 = importeIndexado(t3, 11_077.0608, 12_076.3937);
    expect([t2, t3, t4]).toEqual([926_992, 1_043_387, 1_137_518]);
  });

  /*
   * La regla que esta spec decía antes —desde el inicial con la variación
   * acumulada— da 327.174 en el tercer tramo del #25, no los 327.175 de
   * Gexion. Este test falla con la fórmula vieja.
   */
  it('no calcula desde el importe inicial', () => {
    expect(Math.round((250_000 * 26.03) / 19.89)).not.toBe(327_175);
  });

  it('un índice anterior en cero no se divide', () => {
    expect(() => importeIndexado(100, 0, 1)).toThrow(/mayor que cero/);
  });
});

describe('fechaDelIndice (regla 5)', () => {
  it('ICL: el valor del día en que empieza el tramo', () => {
    expect(fechaDelIndice('ICL', '2025-03-01')).toBe('2025-03-01');
  });

  it('IPC: el mes anterior al del tramo, aunque empiece el 15', () => {
    expect(fechaDelIndice('IPC', '2025-12-15')).toBe('2025-11-01');
    expect(fechaDelIndice('IPC', '2026-01-01')).toBe('2025-12-01');
  });
});

describe('proponerIndexacion (reglas 6 y 7)', () => {
  const IPC: Record<string, number> = { '2026-03-01': 11_077.0608, '2026-07-01': 12_076.3937 };
  const valor = (_i: string, f: string) => IPC[f];

  it('con los dos valores cargados propone el importe, con qué índices', () => {
    const p = proponerIndexacion(
      'IPC',
      { desde: '2026-04-15', importe: 1_043_387 },
      { desde: '2026-08-15' },
      valor,
    );
    expect(p).toEqual({
      estado: 'lista',
      fechaBase: '2026-03-01',
      valorBase: 11_077.0608,
      fechaRequerida: '2026-07-01',
      valorRequerido: 12_076.3937,
      importe: 1_137_518,
    });
  });

  // Regla 7: el IPC de un mes sale a mediados del siguiente.
  it('sin el índice del período: pendiente de índice, y dice cuál falta', () => {
    const p = proponerIndexacion(
      'IPC',
      { desde: '2026-08-15', importe: 1_137_518 },
      { desde: '2026-12-15' },
      valor,
    );
    expect(p).toMatchObject({ estado: 'pendiente_indice', falta: ['el IPC de noviembre de 2026'] });
  });

  it('Casa Propia no tiene fuente: el importe va a mano', () => {
    expect(
      proponerIndexacion(
        'CCP',
        { desde: '2026-01-01', importe: 1 },
        { desde: '2026-05-01' },
        valor,
      ),
    ).toEqual({ estado: 'manual' });
  });
});

describe('alertaIndice (regla 8)', () => {
  it('ICL: avisa a los 3 días sin valores nuevos, no antes', () => {
    expect(alertaIndice('ICL', '2026-10-16', '2026-10-05', '2026-10-08')).toBeNull();
    expect(alertaIndice('ICL', '2026-10-16', '2026-10-05', '2026-10-09')).toMatch(
      /desde el 05\/10\/2026/,
    );
  });

  it('IPC: pasado el 20, el del mes anterior tiene que estar', () => {
    expect(alertaIndice('IPC', '2026-08-01', '2026-09-14', '2026-10-15')).toBeNull();
    expect(alertaIndice('IPC', '2026-08-01', '2026-09-14', '2026-10-21')).toBe(
      'El IPC de septiembre de 2026 ya tendría que estar publicado y no se cargó.',
    );
    expect(alertaIndice('IPC', '2026-09-01', '2026-10-14', '2026-10-21')).toBeNull();
  });

  it('sin ningún valor cargado, avisa', () => {
    expect(alertaIndice('IPC', null, null, '2026-10-05')).toMatch(/Todavía no hay valores del IPC/);
  });
});

describe('validarPartes (regla 4)', () => {
  const P = (
    personaId: string,
    papel: 'propietario' | 'inquilino' | 'garante',
    porcentaje?: number,
  ) => ({ personaId, papel, porcentaje });

  it('un propietario sin porcentaje y un inquilino: está bien', () => {
    expect(validarPartes([P('a', 'propietario'), P('b', 'inquilino')])).toEqual([]);
  });

  it('dos propietarios que suman 100, con decimales', () => {
    expect(
      validarPartes([
        P('a', 'propietario', 33.33),
        P('c', 'propietario', 66.67),
        P('b', 'inquilino'),
      ]),
    ).toEqual([]);
  });

  it('porcentajes que no suman 100', () => {
    expect(
      validarPartes([P('a', 'propietario', 50), P('c', 'propietario', 40), P('b', 'inquilino')]),
    ).toEqual(['Los porcentajes de los propietarios suman 90%, y tienen que sumar 100%.']);
  });

  it('sin propietario o sin inquilino', () => {
    expect(validarPartes([P('b', 'inquilino')])).toContain('Falta el propietario.');
    expect(validarPartes([P('a', 'propietario')])).toContain('Falta el inquilino.');
  });

  it('la misma persona dos veces con el mismo papel', () => {
    expect(
      validarPartes([P('a', 'propietario'), P('b', 'inquilino'), P('b', 'inquilino')]),
    ).toContain('Hay una persona cargada dos veces con el mismo papel.');
  });
});

describe('partesDelMes (regla 13)', () => {
  // Contrato #5: tramo 3 hasta el 14/08/2026, tramo 4 desde el 15/08/2026.
  const tramos = [
    { numero: 3, desde: '2026-04-15', hasta: '2026-08-14', importe: 1_043_387 },
    { numero: 4, desde: '2026-08-15', hasta: '2026-12-14', importe: 1_137_518 },
    { numero: 5, desde: '2026-12-15', hasta: '2027-04-14', importe: null },
  ];

  it('agosto de 2026 en Gexion: dos conceptos proporcionales a los días', () => {
    const p = partesDelMes(2026, 8, tramos);
    expect(p.map((x) => [x.desde, x.hasta, x.dias, x.importe])).toEqual([
      ['2026-08-01', '2026-08-14', 14, 471_207.03],
      ['2026-08-15', '2026-08-31', 17, 623_800.19],
    ]);
  });

  it('septiembre: el mes entero de un solo tramo, sin prorratear', () => {
    expect(partesDelMes(2026, 9, tramos)).toEqual([
      {
        tramo: 4,
        desde: '2026-09-01',
        hasta: '2026-09-30',
        dias: 30,
        diasDelMes: 30,
        importe: 1_137_518,
        proporcional: false,
      },
    ]);
  });

  /*
   * Diciembre de 2026 en Gexion: del 1 al 14 = 513.717,81. Del 15 en adelante
   * el tramo 5 todavía no está indexado y no se genera (regla 11).
   */
  it('diciembre: la parte del tramo sin indexar queda sin importe', () => {
    const p = partesDelMes(2026, 12, tramos);
    expect(p[0]).toMatchObject({ desde: '2026-12-01', hasta: '2026-12-14', importe: 513_717.81 });
    expect(p[1]).toMatchObject({ desde: '2026-12-15', hasta: '2026-12-31', importe: null });
  });

  it('un mes fuera del contrato no tiene partes', () => {
    expect(partesDelMes(2025, 1, tramos)).toEqual([]);
  });
});

describe('cargoConIva (regla 12)', () => {
  // Contrato de muestra en Gexion: alquiler 306.088, honorarios 8%, gastos 2%, IVA 21%.
  it('honorarios y gastos de un mes entero, como en Gexion', () => {
    expect(cargoConIva(306_088, 8, 21)).toBe(29_629.32);
    expect(cargoConIva(306_088, 2, 21)).toBe(7_407.33);
  });

  // Contrato #5, septiembre de 2026: alquiler 1.137.518.
  it('contrato #5, mes entero', () => {
    expect(cargoConIva(1_137_518, 8, 21)).toBe(110_111.74);
    expect(cargoConIva(1_137_518, 2, 21)).toBe(27_527.94);
  });

  /*
   * El caso que fija el método: Gexion redondea el neto y le suma el IVA. El
   * 2,42% aplicado directo daría 12.431,97, un centavo menos.
   */
  it('contrato #5, diciembre proporcional: neto redondeado y IVA sobre el neto', () => {
    expect(cargoConIva(513_717.81, 2, 21)).toBe(12_431.98);
    expect(cargoConIva(513_717.81, 8, 21)).toBe(49_727.88);
  });

  it('sin IVA (una inmobiliaria monotributista) es el porcentaje solo', () => {
    expect(cargoConIva(306_088, 8, 0)).toBe(24_487.04);
  });
});

describe('vencimientoDelMes (regla 37)', () => {
  // Fechas de Gexion, contrato #5.
  it('fin de semana se corre al lunes', () => {
    expect(vencimientoDelMes('2026-12', 5)).toBe('2026-12-07'); // sábado 5
    expect(vencimientoDelMes('2026-10', 10)).toBe('2026-10-12'); // sábado 10
  });

  it('un feriado no se corre: el 12/10/2026 queda el 12', () => {
    expect(vencimientoDelMes('2026-10', 12)).toBe('2026-10-12');
  });

  it('en día hábil queda igual', () => {
    expect(vencimientoDelMes('2026-11', 5)).toBe('2026-11-05');
    expect(vencimientoDelMes('2026-12', 10)).toBe('2026-12-10');
  });
});

describe('repartir', () => {
  it('suma exactamente el total, centavo por centavo', () => {
    expect(repartir(100_000.01, [50, 50])).toEqual([50_000.01, 50_000]);
    expect(repartir(1_000, [33.33, 33.33, 33.34])).toEqual([333.3, 333.3, 333.4]);
    expect(repartir(513_717.81, [100])).toEqual([513_717.81]);
  });
});

describe('generarPeriodo (reglas 9 a 13)', () => {
  const INQ = 'inq';
  const DUENO = 'dueno';
  /* Contrato #5 de Gexion: IPC, 8% de honorarios, 2% de gastos, IVA 21%. */
  const c5 = (over: Partial<ContratoParaGenerar> = {}): ContratoParaGenerar => ({
    id: 'c5',
    moneda: 'ARS',
    inicio: '2025-08-15',
    fin: '2027-08-14',
    rescindidoEl: null,
    diaVencimiento: 5,
    diaPagoPropietario: 10,
    honorariosPct: 8,
    gastosAdmPct: 2,
    ivaPct: 0,
    tramos: [
      { numero: 1, desde: '2025-08-15', hasta: '2025-12-14', importe: 850_000 },
      { numero: 2, desde: '2025-12-15', hasta: '2026-04-14', importe: 926_992 },
      { numero: 3, desde: '2026-04-15', hasta: '2026-08-14', importe: 1_043_387 },
      { numero: 4, desde: '2026-08-15', hasta: '2026-12-14', importe: 1_137_518 },
      { numero: 5, desde: '2026-12-15', hasta: '2027-04-14', importe: null },
    ],
    propietarios: [{ personaId: DUENO, porcentaje: 100 }],
    inquilinos: [{ personaId: INQ }],
    ...over,
  });
  const resumen = (r: ReturnType<typeof generarPeriodo>) =>
    r.conceptos.map((x) => [x.tipo, x.sentido, x.personaId, x.importe, x.vencimiento]);

  // Regla 9, mes entero: noviembre de 2026 en Gexion.
  it('un mes entero: alquiler a cobrar y a pagar, gastos y honorarios', () => {
    expect(resumen(generarPeriodo(c5(), '2026-11', 21))).toEqual([
      ['alquiler', 'a_cobrar', INQ, 1_137_518, '2026-11-05'],
      ['gastos_adm', 'a_cobrar', INQ, 27_527.94, '2026-11-05'],
      ['alquiler', 'a_pagar', DUENO, 1_137_518, '2026-11-10'],
      ['honorarios', 'a_cobrar', DUENO, 110_111.74, '2026-11-10'],
    ]);
  });

  // Regla 13: diciembre de 2025 en Gexion, cambio de tramo el 15.
  it('cambio de tramo: dos partes proporcionales, cada una con sus gastos y honorarios', () => {
    const r = generarPeriodo(c5(), '2025-12', 21);
    expect(r.conceptos.filter((x) => x.personaId === INQ).map((x) => [x.tipo, x.importe])).toEqual([
      ['alquiler', 383_870.97],
      ['gastos_adm', 9_289.68],
      ['alquiler', 508_350.45],
      ['gastos_adm', 12_302.08],
    ]);
    expect(r.conceptos.filter((x) => x.tipo === 'honorarios').map((x) => x.importe)).toEqual([
      37_158.71, 49_208.33,
    ]);
    expect(r.conceptos[0]!.descripcion).toBe('Alquiler 01/12 al 14/12/2025 (14/31 días)');
  });

  // Regla 11: diciembre de 2026 en Gexion genera del 1 al 14 y nada más.
  it('la parte de un tramo sin indexar no se genera y se informa', () => {
    const r = generarPeriodo(c5(), '2026-12', 21);
    expect(resumen(r)).toEqual([
      ['alquiler', 'a_cobrar', INQ, 513_717.81, '2026-12-07'],
      ['gastos_adm', 'a_cobrar', INQ, 12_431.98, '2026-12-07'],
      ['alquiler', 'a_pagar', DUENO, 513_717.81, '2026-12-10'],
      ['honorarios', 'a_cobrar', DUENO, 49_727.88, '2026-12-10'],
    ]);
    expect(r.sinIndexar).toMatchObject([{ tramo: 5, desde: '2026-12-15', hasta: '2026-12-31' }]);
  });

  // Regla 10: la clave identifica cada concepto; generar de nuevo da las mismas.
  it('las claves son estables y no se repiten', () => {
    const a = generarPeriodo(c5(), '2025-12', 21).conceptos.map((x) => x.clave);
    expect(generarPeriodo(c5(), '2025-12', 21).conceptos.map((x) => x.clave)).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
  });

  it('el primer mes, proporcional desde el inicio', () => {
    const r = generarPeriodo(c5(), '2025-08', 21);
    expect(r.conceptos[0]).toMatchObject({
      importe: 466_129.03,
      descripcion: 'Alquiler 15/08 al 31/08/2025 (17/31 días)',
    });
  });

  it('fuera del contrato no genera nada', () => {
    expect(generarPeriodo(c5(), '2025-07', 21).conceptos).toEqual([]);
  });

  // Regla 3: rescindido, hasta el mes de la rescisión inclusive.
  it('rescindido: genera el mes de la rescisión, no los siguientes', () => {
    expect(
      generarPeriodo(c5({ rescindidoEl: '2026-03-20' }), '2026-03', 21).conceptos,
    ).toHaveLength(4);
    expect(generarPeriodo(c5({ rescindidoEl: '2026-03-20' }), '2026-04', 21).conceptos).toEqual([]);
  });

  // Contrato #72: comercial con honorarios en 0%.
  it('un porcentaje en cero no genera un concepto en cero', () => {
    const r = generarPeriodo(c5({ honorariosPct: 0 }), '2026-11', 21);
    expect(r.conceptos.map((x) => x.tipo)).not.toContain('honorarios');
  });

  it('dos propietarios: el alquiler y los honorarios por su parte, sin perder centavos', () => {
    const r = generarPeriodo(
      c5({
        propietarios: [
          { personaId: 'a', porcentaje: 50 },
          { personaId: 'b', porcentaje: 50 },
        ],
      }),
      '2026-12',
      21,
    );
    const aPagar = r.conceptos.filter((x) => x.sentido === 'a_pagar').map((x) => x.importe);
    expect(aPagar).toEqual([256_858.91, 256_858.9]);
    expect(aPagar[0]! + aPagar[1]!).toBeCloseTo(513_717.81, 2);
  });

  // Caso construido: ningún contrato de Vacker tiene IVA del alquiler.
  it('IVA del alquiler: lo paga el inquilino y lo recibe el propietario', () => {
    const r = generarPeriodo(c5({ ivaPct: 21 }), '2026-11', 21);
    expect(r.conceptos.filter((x) => x.tipo === 'iva').map((x) => [x.sentido, x.importe])).toEqual([
      ['a_cobrar', 238_878.78],
      ['a_pagar', 238_878.78],
    ]);
  });

  it('un contrato en dólares genera en dólares (regla 18)', () => {
    expect(
      generarPeriodo(c5({ moneda: 'USD' }), '2026-11', 21).conceptos.every(
        (x) => x.moneda === 'USD',
      ),
    ).toBe(true);
  });
});

describe('planificarCobro (reglas 15 y 17)', () => {
  const alquiler = { conceptoId: 'alq', saldo: 1_137_518 };
  const gastos = { conceptoId: 'gas', saldo: 27_527.94 };

  it('paga del más viejo al más nuevo y el último queda parcial', () => {
    const p = planificarCobro({
      importe: 1_150_000,
      creditos: [],
      compensables: [],
      deudas: [alquiler, gastos],
    });
    expect(p.imputaciones).toEqual([
      { cobroId: null, conceptoId: 'alq', importe: 1_137_518 },
      { cobroId: null, conceptoId: 'gas', importe: 12_482 },
    ]);
    expect(p.sobrante).toBe(0);
  });

  // Regla 17.
  it('lo que sobra queda a favor', () => {
    expect(
      planificarCobro({
        importe: 1_200_000,
        creditos: [],
        compensables: [],
        deudas: [alquiler, gastos],
      }).sobrante,
    ).toBe(34_954.06);
  });

  it('el saldo a favor de un cobro anterior se usa primero', () => {
    const p = planificarCobro({
      importe: 1_130_000,
      creditos: [{ cobroId: 'viejo', disponible: 34_954.06 }],
      compensables: [],
      deudas: [alquiler],
    });
    expect(p.imputaciones).toEqual([
      { cobroId: 'viejo', conceptoId: 'alq', importe: 34_954.06 },
      { cobroId: null, conceptoId: 'alq', importe: 1_102_563.94 },
    ]);
    expect(p).toMatchObject({ saldoAFavorUsado: 34_954.06, sobrante: 27_436.06 });
  });

  // El inquilino pagó una reparación del dueño: se le descuenta de lo que debe.
  it('un reintegro a favor se compensa contra la deuda', () => {
    const p = planificarCobro({
      importe: 996_819,
      creditos: [],
      compensables: [{ conceptoId: 'rep', saldo: 140_699 }],
      deudas: [alquiler],
    });
    expect(p.imputaciones).toEqual([
      { cobroId: null, conceptoId: 'rep', importe: 140_699 },
      { cobroId: null, conceptoId: 'alq', importe: 1_137_518 },
    ]);
    expect(p).toMatchObject({ compensado: 140_699, sobrante: 0 });
  });

  it('el reintegro no se compensa más allá de la deuda', () => {
    const p = planificarCobro({
      importe: 1,
      creditos: [],
      compensables: [{ conceptoId: 'rep', saldo: 500 }],
      deudas: [{ conceptoId: 'x', saldo: 200 }],
    });
    expect(p.compensado).toBe(200);
    expect(p.sobrante).toBe(1);
  });

  it('centavos exactos, sin restos de coma flotante', () => {
    const p = planificarCobro({
      importe: 0.3,
      creditos: [],
      compensables: [],
      deudas: [
        { conceptoId: 'a', saldo: 0.1 },
        { conceptoId: 'b', saldo: 0.2 },
      ],
    });
    expect(p.imputaciones.map((i) => i.importe)).toEqual([0.1, 0.2]);
    expect(p.sobrante).toBe(0);
  });
});

describe('proponerPunitorio (regla 16)', () => {
  it('saldo × tasa diaria × días de atraso', () => {
    expect(proponerPunitorio(1_137_518, '2026-11-05', '2026-11-15', 0.1)).toEqual({
      dias: 10,
      importe: 11_375.18,
    });
  });

  it('pagado en fecha o antes, nada', () => {
    expect(proponerPunitorio(1_137_518, '2026-11-05', '2026-11-05', 0.1)).toEqual({
      dias: 0,
      importe: 0,
    });
    expect(proponerPunitorio(1_137_518, '2026-11-05', '2026-11-02', 0.1)).toEqual({
      dias: 0,
      importe: 0,
    });
  });

  it('sin tasa en el contrato, nada', () => {
    expect(proponerPunitorio(1_137_518, '2026-11-05', '2026-11-15', 0).importe).toBe(0);
  });
});

describe('proponerLiquidacion (reglas 20 a 22)', () => {
  /* Noviembre de 2026 del contrato #5, como lo genera generarPeriodo. */
  const parte = 'alq|c5|2026-11|2026-11-01';
  const alquiler = {
    id: 'alq',
    tipo: 'alquiler',
    sentido: 'a_pagar' as const,
    saldo: 1_137_518,
    clave: `${parte}|alquiler|a_pagar|dueno`,
    pagoGarantizado: false,
  };
  const honorarios = {
    id: 'hon',
    tipo: 'honorarios',
    sentido: 'a_cobrar' as const,
    saldo: 110_111.74,
    clave: `${parte}|honorarios|a_cobrar|dueno`,
    pagoGarantizado: false,
  };
  const reparacion = {
    id: 'rep',
    tipo: 'reparacion',
    sentido: 'a_cobrar' as const,
    saldo: 140_699,
    clave: null,
    pagoGarantizado: false,
  };

  it('la parte de una clave es contrato, período y desde', () => {
    expect(parteDeClave(alquiler.clave)).toBe(parte);
    expect(parteDeClave(null)).toBeNull();
  });

  // Regla 20: neto = alquiler cobrado − honorarios − gastos suyos.
  it('inquilino al día: alquiler menos honorarios menos la reparación', () => {
    const p = proponerLiquidacion(
      [alquiler, honorarios, reparacion],
      new Set([`${parte}#alquiler`]),
    );
    expect(p.aPagar.map((x) => x.id)).toEqual(['alq']);
    expect(p.aDescontar.map((x) => x.id)).toEqual(['hon', 'rep']);
    expect(p.neto).toBe(886_707.26);
  });

  // Regla 22: sin pago del inquilino, el alquiler y sus honorarios esperan.
  it('sin pago del inquilino, el alquiler y sus honorarios quedan en espera', () => {
    const p = proponerLiquidacion([alquiler, honorarios], new Set());
    expect(p.enEspera.map((x) => x.id)).toEqual(['alq', 'hon']);
    expect(p.aPagar).toEqual([]);
    expect(p.neto).toBe(0);
  });

  // Regla 21.
  it('con pago garantizado se liquida aunque el inquilino no haya pagado', () => {
    const p = proponerLiquidacion([{ ...alquiler, pagoGarantizado: true }, honorarios], new Set());
    expect(p.neto).toBe(1_027_406.26);
    expect(p.enEspera).toEqual([]);
  });

  // Regla 22 (desde el 6/10/2026): un pago parcial libera la misma proporción.
  // Es el caso de ALT-0004 en Alteva: el inquilino pagó $ 200.000 de un
  // alquiler de $ 415.427, con dos dueños al 50%.
  describe('pago parcial del inquilino', () => {
    const dueno = { ...alquiler, saldo: 207_713.5 };
    const hon = { ...honorarios, saldo: 20_106.67 };
    const pago = new Map([[`${parte}#alquiler`, 200_000 / 415_427]]);

    it('se le liquida la proporción cobrada y el resto queda en espera', () => {
      const p = proponerLiquidacion([dueno, hon], pago);
      expect(p.aPagar).toEqual([{ ...dueno, saldo: 100_000, parcial: true }]);
      expect(p.aDescontar).toEqual([{ ...hon, saldo: 9_680, parcial: true }]);
      expect(p.enEspera.map((x) => [x.id, x.saldo])).toEqual([
        ['alq', 107_713.5],
        ['hon', 10_426.67],
      ]);
      expect(p.neto).toBe(90_320);
    });

    it('lo ya liquidado no se vuelve a liquidar: con el pago completo entra el resto', () => {
      const resto = { ...dueno, saldo: 107_713.5, yaLiquidado: 100_000 };
      const p = proponerLiquidacion([resto], new Map([[`${parte}#alquiler`, 1]]));
      expect(p.aPagar).toEqual([resto]);
      expect(p.enEspera).toEqual([]);
    });

    it('si no pagó nada más desde la última liquidación, no entra nada', () => {
      const resto = { ...dueno, saldo: 107_713.5, yaLiquidado: 100_000 };
      const p = proponerLiquidacion([resto], pago);
      expect(p.aPagar).toEqual([]);
      expect(p.enEspera).toEqual([resto]);
    });

    it('un segundo pago parcial libera solo la diferencia', () => {
      const resto = { ...dueno, saldo: 107_713.5, yaLiquidado: 100_000 };
      const p = proponerLiquidacion([resto], new Map([[`${parte}#alquiler`, 0.75]]));
      // 75% de 207.713,50 = 155.785,13; ya se liquidaron 100.000.
      expect(p.aPagar.map((x) => x.saldo)).toEqual([55_785.13]);
      expect(p.enEspera.map((x) => x.saldo)).toEqual([51_928.37]);
    });
  });

  it('un reintegro a su favor se le paga', () => {
    const reintegro = {
      id: 'rei',
      tipo: 'reparacion',
      sentido: 'a_pagar' as const,
      saldo: 50_000,
      clave: null,
      pagoGarantizado: false,
    };
    expect(proponerLiquidacion([reintegro], new Set()).neto).toBe(50_000);
  });
});

describe('tramoDeMora (regla 29)', () => {
  it('cada borde cae en su tramo', () => {
    expect([1, 30, 31, 60, 61, 90, 91].map(tramoDeMora)).toEqual([
      '1-30',
      '1-30',
      '31-60',
      '31-60',
      '61-90',
      '61-90',
      '90+',
    ]);
  });
});

describe('estadoDeFirma (regla 33)', () => {
  it('sale de los firmantes', () => {
    expect(estadoDeFirma('enviado', ['firmado', 'firmado', 'firmado'])).toBe('firmado');
    expect(estadoDeFirma('enviado', ['firmado', 'pendiente'])).toBe('firmado_parcial');
    expect(estadoDeFirma('firmado_parcial', ['firmado', 'rechazado'])).toBe('rechazado');
  });

  it('si nadie firmó, queda como estaba; y si se desmarca lo firmado, vuelve a enviado', () => {
    expect(estadoDeFirma('sin_enviar', ['pendiente'])).toBe('sin_enviar');
    expect(estadoDeFirma('vencido', ['pendiente'])).toBe('vencido');
    expect(estadoDeFirma('firmado', ['pendiente', 'pendiente'])).toBe('enviado');
  });
});

describe('redondear2', () => {
  it('redondea mitad hacia arriba sin el error de coma flotante', () => {
    expect(redondear2(1.005)).toBe(1.01);
    expect(redondear2(471_207.032)).toBe(471_207.03);
  });
});

describe('enLetras (entrega 15)', () => {
  it('números en letras, como en un contrato', () => {
    expect(enLetras(350_000)).toBe('trescientos cincuenta mil');
    expect(enLetras(1_137_518)).toBe('un millón ciento treinta y siete mil quinientos dieciocho');
    expect(enLetras(21_000)).toBe('veintiún mil');
    expect(enLetras(101)).toBe('ciento uno');
    expect(enLetras(100)).toBe('cien');
    expect(enLetras(2_500_000)).toBe('dos millones quinientos mil');
    expect(enLetras(1000)).toBe('mil');
  });

  it('el importe en letras con su moneda y los centavos', () => {
    expect(importeEnLetras(254_100.5, 'ARS')).toBe(
      'pesos doscientos cincuenta y cuatro mil cien con 50/100',
    );
    expect(importeEnLetras(1500, 'USD')).toBe('dólares estadounidenses mil quinientos');
  });
});

describe('alquilerDeHoy y proximoCambio (una sola definición)', () => {
  const tramos = [
    { numero: 1, desde: '2026-01-01', importe: 100_000 },
    { numero: 2, desde: '2026-05-01', importe: null },
    { numero: 3, desde: '2026-09-01', importe: null },
  ];
  it('si el tramo de hoy espera indexación, rige el anterior', () => {
    expect(alquilerDeHoy(tramos, '2026-06-15')).toBe(100_000);
    expect(alquilerDeHoy(tramos, '2025-12-31')).toBeNull();
  });
  it('el próximo cambio es el primer tramo sin importe, aunque ya haya pasado', () => {
    expect(proximoCambio(tramos, '2026-06-15')).toBe('2026-05-01');
    expect(
      proximoCambio(
        [
          { numero: 1, desde: '2026-01-01', importe: 1 },
          { numero: 2, desde: '2026-07-01', importe: 2 },
        ],
        '2026-06-15',
      ),
    ).toBe('2026-07-01');
    expect(
      proximoCambio([{ numero: 1, desde: '2026-01-01', importe: 1 }], '2026-06-15'),
    ).toBeNull();
  });
});
