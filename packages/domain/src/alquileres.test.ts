import { describe, expect, it } from 'vitest';
import {
  alertaIndice,
  cargoConIva,
  fechaDelIndice,
  generarTramos,
  importeIndexado,
  partesDelMes,
  proponerIndexacion,
  redondear2,
  sumarMesesIso,
  validarPartes,
  validarTramos,
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
    for (const [i, f, p] of [['2025-01-31', '2027-01-30', 3], ['2024-02-29', '2026-02-28', 6], ['2026-03-15', '2029-03-14', 4]] as const) {
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
    expect(validarTramos('2026-01-01', '2026-08-31', t)).toEqual(['Del 01/05/2026 al 14/05/2026 no hay tramo.']);
  });

  it('una superposición se nombra con los tramos', () => {
    const t = [base[0]!, { ...base[1]!, desde: '2026-04-20' }];
    expect(validarTramos('2026-01-01', '2026-08-31', t)).toEqual(['Los tramos 1 y 2 se superponen desde el 20/04/2026.']);
  });

  it('falta cubrir el final del contrato', () => {
    expect(validarTramos('2026-01-01', '2026-12-31', base)).toEqual(['Del 01/09/2026 al 31/12/2026 no hay tramo.']);
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
    const p = proponerIndexacion('IPC', { desde: '2026-04-15', importe: 1_043_387 }, { desde: '2026-08-15' }, valor);
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
    const p = proponerIndexacion('IPC', { desde: '2026-08-15', importe: 1_137_518 }, { desde: '2026-12-15' }, valor);
    expect(p).toMatchObject({ estado: 'pendiente_indice', falta: ['el IPC de noviembre de 2026'] });
  });

  it('Casa Propia no tiene fuente: el importe va a mano', () => {
    expect(proponerIndexacion('CCP', { desde: '2026-01-01', importe: 1 }, { desde: '2026-05-01' }, valor)).toEqual({ estado: 'manual' });
  });
});

describe('alertaIndice (regla 8)', () => {
  it('ICL: avisa a los 3 días sin valores nuevos, no antes', () => {
    expect(alertaIndice('ICL', '2026-10-16', '2026-10-05', '2026-10-08')).toBeNull();
    expect(alertaIndice('ICL', '2026-10-16', '2026-10-05', '2026-10-09')).toMatch(/desde el 05\/10\/2026/);
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
  const P = (personaId: string, papel: 'propietario' | 'inquilino' | 'garante', porcentaje?: number) => ({ personaId, papel, porcentaje });

  it('un propietario sin porcentaje y un inquilino: está bien', () => {
    expect(validarPartes([P('a', 'propietario'), P('b', 'inquilino')])).toEqual([]);
  });

  it('dos propietarios que suman 100, con decimales', () => {
    expect(validarPartes([P('a', 'propietario', 33.33), P('c', 'propietario', 66.67), P('b', 'inquilino')])).toEqual([]);
  });

  it('porcentajes que no suman 100', () => {
    expect(validarPartes([P('a', 'propietario', 50), P('c', 'propietario', 40), P('b', 'inquilino')])).toEqual([
      'Los porcentajes de los propietarios suman 90%, y tienen que sumar 100%.',
    ]);
  });

  it('sin propietario o sin inquilino', () => {
    expect(validarPartes([P('b', 'inquilino')])).toContain('Falta el propietario.');
    expect(validarPartes([P('a', 'propietario')])).toContain('Falta el inquilino.');
  });

  it('la misma persona dos veces con el mismo papel', () => {
    expect(validarPartes([P('a', 'propietario'), P('b', 'inquilino'), P('b', 'inquilino')])).toContain(
      'Hay una persona cargada dos veces con el mismo papel.',
    );
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
      { tramo: 4, desde: '2026-09-01', hasta: '2026-09-30', dias: 30, diasDelMes: 30, importe: 1_137_518, proporcional: false },
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

describe('redondear2', () => {
  it('redondea mitad hacia arriba sin el error de coma flotante', () => {
    expect(redondear2(1.005)).toBe(1.01);
    expect(redondear2(471_207.032)).toBe(471_207.03);
  });
});
