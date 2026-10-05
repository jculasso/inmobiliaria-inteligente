import { describe, expect, it } from 'vitest';
import {
  cargoConIva,
  generarTramos,
  importeIndexado,
  partesDelMes,
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
   * Contrato #25 (ICL): importe inicial 250.000. Gexion muestra la variación
   * acumulada de cada tramo con dos decimales, así que acá se usa la
   * variación como relación de índices.
   */
  it('desde el inicial con la variación acumulada, a peso entero', () => {
    expect(importeIndexado(250_000, 1, 1.3087)).toBe(327_175); // tramo 3 en Gexion
    expect(importeIndexado(250_000, 1, 1.7215)).toBe(430_375); // tramo 6 en Gexion
  });

  /*
   * La razón de la regla: encadenar sobre el tramo anterior (287.079 × 1,1397)
   * daría 327.184, nueve pesos de diferencia con Gexion en el tercer tramo.
   */
  it('no encadena sobre el tramo anterior', () => {
    expect(importeIndexado(250_000, 1, 1.3087)).not.toBe(Math.round(287_079 * 1.1397));
  });

  it('con valores reales del índice, la relación es requerido ÷ base', () => {
    expect(importeIndexado(200_000, 20.5, 23.1)).toBe(Math.round((200_000 * 23.1) / 20.5));
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
