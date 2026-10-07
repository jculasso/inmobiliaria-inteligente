import { describe, expect, it } from 'vitest';
import {
  MARCA_PARTE_LIQUIDADA,
  cadenaDelInforme,
  categoriaDelInforme,
  estadosDelInforme,
  mesesDelRango,
  nombreDelRango,
  sumarCadenas,
  type ConceptoDelInforme,
} from './informe-propietario';

const PARTE = 'alq|c5|2026-09|2026-09-01';
const alquiler = (over: Partial<ConceptoDelInforme> = {}): ConceptoDelInforme => ({
  id: 'alq',
  tipo: 'alquiler',
  sentido: 'a_pagar',
  base: 1_000_000,
  liquidado: false,
  clave: `${PARTE}|alquiler|a_pagar|dueno`,
  origenId: null,
  pagoGarantizado: false,
  ...over,
});
const honorarios = (over: Partial<ConceptoDelInforme> = {}): ConceptoDelInforme =>
  alquiler({
    id: 'hon',
    tipo: 'honorarios',
    sentido: 'a_cobrar',
    base: 96_800,
    clave: `${PARTE}|honorarios|a_cobrar|dueno`,
    ...over,
  });
const gasto = (id: string, tipo: string, base: number, over: Partial<ConceptoDelInforme> = {}) =>
  alquiler({ id, tipo, sentido: 'a_cobrar', base, clave: `bol|${id}|c|dueno`, ...over });

/** La cadena de un juego de conceptos, como la arma el informe. */
function cadena(conceptos: ConceptoDelInforme[], cobrado: Map<string, number>) {
  const estados = estadosDelInforme(conceptos, cobrado);
  return cadenaDelInforme(
    conceptos.map((k) => ({
      categoria: categoriaDelInforme(k.tipo, k.sentido)!,
      ...estados.get(k.id)!,
    })),
  );
}

describe('categoriaDelInforme (regla 87)', () => {
  it('pone cada concepto del propietario en su renglón', () => {
    expect(categoriaDelInforme('alquiler', 'a_pagar')).toBe('alquiler');
    expect(categoriaDelInforme('iva', 'a_pagar')).toBe('alquiler');
    expect(categoriaDelInforme('impuesto', 'a_pagar')).toBe('reintegros');
    expect(categoriaDelInforme('honorarios', 'a_cobrar')).toBe('honorarios');
    expect(categoriaDelInforme('impuesto', 'a_cobrar')).toBe('impuestos');
    expect(categoriaDelInforme('servicio', 'a_cobrar')).toBe('impuestos');
    expect(categoriaDelInforme('expensa', 'a_cobrar')).toBe('expensas');
    expect(categoriaDelInforme('reparacion', 'a_cobrar')).toBe('arreglos');
    expect(categoriaDelInforme('otro', 'a_cobrar')).toBe('otros');
  });

  it('lo que no se le descuenta al propietario no entra (regla 86)', () => {
    expect(categoriaDelInforme('alquiler', 'a_cobrar')).toBeNull();
    expect(categoriaDelInforme('gastos_adm', 'a_cobrar')).toBeNull();
    expect(categoriaDelInforme('punitorio', 'a_cobrar')).toBeNull();
  });
});

describe('la cadena cierra al centavo (regla 87)', () => {
  it('alquiler cobrado y liquidado, con honorarios y un impuesto que va en la próxima', () => {
    const c = cadena(
      [
        alquiler({ liquidado: true }),
        honorarios({ liquidado: true }),
        gasto('tgi', 'impuesto', 12_345.67),
      ],
      new Map([[`${PARTE}#alquiler`, 1]]),
    );
    expect(c).toEqual({
      alquiler: 1_000_000,
      enEspera: 0,
      cobrado: 1_000_000,
      honorarios: 96_800,
      impuestos: 12_345.67,
      expensas: 0,
      arreglos: 0,
      otros: 0,
      reintegros: 0,
      neto: 890_854.33,
      liquidado: 903_200,
      pendiente: 0,
      aDescontar: 12_345.67,
    });
    expect(c.neto).toBeCloseTo(c.liquidado + c.pendiente - c.aDescontar, 2);
  });

  it('un pago parcial libera la misma proporción del alquiler y de sus honorarios (regla 22)', () => {
    const c = cadena([alquiler(), honorarios()], new Map([[`${PARTE}#alquiler`, 0.5]]));
    expect(c).toMatchObject({
      alquiler: 1_000_000,
      enEspera: 500_000,
      cobrado: 500_000,
      // Lo que espera al inquilino no se descontó todavía.
      honorarios: 48_400,
      neto: 451_600,
      liquidado: 0,
      pendiente: 451_600,
    });
  });

  it('con una parte ya liquidada por un pago parcial, cuenta las dos partes', () => {
    const parte = alquiler({
      id: 'parte',
      base: 400_000,
      liquidado: true,
      clave: `${PARTE}|alquiler|a_pagar|dueno${MARCA_PARTE_LIQUIDADA}liq1`,
      origenId: 'alq',
    });
    // El original quedó con el resto (600.000); el inquilino ya pagó el 70%.
    const c = cadena([parte, alquiler({ base: 600_000 })], new Map([[`${PARTE}#alquiler`, 0.7]]));
    expect(c).toMatchObject({
      alquiler: 1_000_000,
      cobrado: 700_000,
      enEspera: 300_000,
      liquidado: 400_000,
      pendiente: 300_000,
    });
  });

  it('con pago garantizado el alquiler está para el propietario aunque el inquilino no pagó (regla 21)', () => {
    const c = cadena([alquiler({ pagoGarantizado: true })], new Map());
    expect(c).toMatchObject({ cobrado: 1_000_000, enEspera: 0, pendiente: 1_000_000 });
  });

  it('lo que el propietario pagó por caja no se le descuenta', () => {
    const c = cadena([gasto('exp', 'expensa', 0)], new Map());
    expect(c.expensas).toBe(0);
  });

  it('expensas, arreglos, otros y reintegros van a su renglón', () => {
    const c = cadena(
      [
        gasto('exp', 'expensa', 30_000),
        gasto('arr', 'reparacion', 50_000, { liquidado: true }),
        gasto('pol', 'otro', 5_000),
        alquiler({ id: 'rei', tipo: 'servicio', base: 8_000, clave: 'bol|x|r|dueno' }),
      ],
      new Map(),
    );
    expect(c).toMatchObject({
      expensas: 30_000,
      arreglos: 50_000,
      otros: 5_000,
      reintegros: 8_000,
      neto: -77_000,
      liquidado: -50_000,
      pendiente: 0,
      aDescontar: 27_000,
    });
  });

  it('suma cadenas de una moneda en centavos', () => {
    const a = cadena([alquiler({ base: 0.1 })], new Map([[`${PARTE}#alquiler`, 1]]));
    const b = cadena([alquiler({ base: 0.2 })], new Map([[`${PARTE}#alquiler`, 1]]));
    expect(sumarCadenas([a, b]).cobrado).toBe(0.3);
  });
});

describe('lo que falta liquidar nunca es negativo (regla 98)', () => {
  // El caso de Marcela Ibarra en Alteva (octubre de 2026): el alquiler ya se
  // liquidó y después se cargó un arreglo a cargo del propietario que todavía
  // no se descontó. Antes salía «Pendiente de liquidar −$ 15.000».
  it('alquiler liquidado y un arreglo posterior sin liquidar: a descontar, no pendiente negativo', () => {
    const parte = 'alq|c1|2026-10|2026-10-01';
    const c = cadena(
      [
        alquiler({ base: 674_605, liquidado: true, clave: `${parte}|alquiler|a_pagar|dueno` }),
        honorarios({
          base: 65_301.76,
          liquidado: true,
          clave: `${parte}|honorarios|a_cobrar|dueno`,
        }),
        alquiler({
          id: 'arreglo',
          tipo: 'reparacion',
          sentido: 'a_cobrar',
          base: 15_000,
          clave: 'prov|comp-reclamo-2|dueno',
        }),
      ],
      new Map([[`${parte}#alquiler`, 1]]),
    );
    expect(c).toMatchObject({
      alquiler: 674_605,
      cobrado: 674_605,
      honorarios: 65_301.76,
      arreglos: 15_000,
      neto: 594_303.24,
      liquidado: 609_303.24,
      pendiente: 0,
      aDescontar: 15_000,
    });
    const cent = (x: number) => Math.round(x * 100);
    expect(cent(c.liquidado) + cent(c.pendiente) - cent(c.aDescontar)).toBe(cent(c.neto));
  });

  it('si lo pendiente a su favor supera lo que se le descuenta, queda neto y no hay nada a descontar', () => {
    // Septiembre cobrado sin liquidar y una TGI: se compensan en la próxima.
    const c = cadena(
      [alquiler(), gasto('tgi', 'impuesto', 12_345.67)],
      new Map([[`${PARTE}#alquiler`, 1]]),
    );
    expect(c).toMatchObject({ pendiente: 987_654.33, aDescontar: 0, liquidado: 0 });
  });

  it('los totales suman lo pendiente y lo a descontar de cada propietario por separado', () => {
    const t = sumarCadenas([
      cadena([alquiler()], new Map([[`${PARTE}#alquiler`, 1]])),
      cadena([gasto('tgi', 'impuesto', 100)], new Map()),
    ]);
    expect(t).toMatchObject({ pendiente: 1_000_000, aDescontar: 100, neto: 999_900 });
  });
});

describe('el período del informe (regla 84)', () => {
  it('lista los meses, también entre años', () => {
    expect(mesesDelRango('2026-09', '2026-09')).toEqual(['2026-09']);
    expect(mesesDelRango('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('lo nombra como lo lee el propietario', () => {
    expect(nombreDelRango('2026-09', '2026-09')).toBe('septiembre 2026');
    expect(nombreDelRango('2026-07', '2026-09')).toBe('julio a septiembre 2026');
    expect(nombreDelRango('2026-01', '2026-12')).toBe('año 2026');
    expect(nombreDelRango('2025-11', '2026-01')).toBe('noviembre 2025 a enero 2026');
  });
});
