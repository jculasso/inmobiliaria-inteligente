import { describe, expect, it } from 'vitest';
import {
  BoletaDtoSchema,
  COMBINACIONES_QUIEN_PAGA,
  CuotaSchema,
  consecuenciaDeBoleta,
  partesDeCuota,
  recuperoDeBoleta,
  textoCuota,
  unirCuota,
} from './alquileres';

// Impuestos y servicios, rediseño del 7/10/2026 (spec alquileres-fase-1.md, reglas 45 a 53).

describe('regla 46: qué pasa con la plata, según quién la debe y quién la paga', () => {
  it.each([
    ['inquilino', 'inquilino', 'La paga el inquilino: solo hay que pedirle el comprobante'],
    ['propietario', 'propietario', 'La paga el propietario: solo hay que pedirle el comprobante'],
    [
      'inquilino',
      'inmobiliaria',
      'La paga la inmobiliaria y se le cobra al inquilino en su próximo recibo',
    ],
    [
      'propietario',
      'inmobiliaria',
      'La paga la inmobiliaria y se le descuenta al propietario al liquidar',
    ],
    [
      'propietario',
      'inquilino',
      'La paga el inquilino y se le descuenta al propietario (al inquilino se le reconoce)',
    ],
    [
      'inquilino',
      'propietario',
      'La paga el propietario y se le cobra al inquilino para devolvérsela',
    ],
  ] as const)('regla 46: la debe el %s y la paga %s', (aCargoDe, paga, frase) => {
    expect(consecuenciaDeBoleta(aCargoDe, paga)).toBe(frase);
  });

  it('regla 46: sin contrato ese mes no se le carga a nadie, la pague quien la pague', () => {
    for (const { aCargoDe, paga } of COMBINACIONES_QUIEN_PAGA)
      expect(consecuenciaDeBoleta(aCargoDe, paga, false)).toBe(
        'Sin contrato ese mes: no se le carga a nadie, queda para control',
      );
  });

  it('regla 46: el alta ofrece las seis combinaciones, cada una con su frase distinta', () => {
    expect(COMBINACIONES_QUIEN_PAGA).toHaveLength(6);
    const frases = COMBINACIONES_QUIEN_PAGA.map((c) => consecuenciaDeBoleta(c.aCargoDe, c.paga));
    expect(new Set(frases).size).toBe(6);
  });
});

describe('regla 47: el recupero, después de pagada', () => {
  it('regla 47: ya recuperado, o lo que falta, según a quién se le cargó', () => {
    const r = (aCargoDe: 'inquilino' | 'propietario', cargoRecuperado: boolean) =>
      recuperoDeBoleta({ aCargoDe, paga: 'inmobiliaria', cargoRecuperado });
    expect(r('inquilino', true)).toBe('Ya se le cobró al inquilino');
    expect(r('propietario', true)).toBe('Ya se le descontó al propietario');
    expect(r('propietario', false)).toBe(
      'Falta descontárselo al propietario: va en su próxima liquidación',
    );
    expect(r('inquilino', false)).toBe('Falta cobrárselo al inquilino: va en su próximo recibo');
  });

  it('regla 47: si la pagó quien la debía, o no hubo contrato, no hay recupero', () => {
    expect(
      recuperoDeBoleta({ aCargoDe: 'inquilino', paga: 'inquilino', cargoRecuperado: null }),
    ).toBeNull();
    expect(
      recuperoDeBoleta({ aCargoDe: 'inquilino', paga: 'inmobiliaria', cargoRecuperado: null }),
    ).toBeNull();
  });

  it('regla 47: una respuesta de la API anterior al campo se lee igual (sin recupero)', () => {
    const vieja = {
      id: '33333333-3333-4333-8333-333333333333',
      nombre: 'API',
      clase: 'impuesto',
      cuentaId: null,
      polizaId: null,
      numeroCuenta: null,
      propiedad: 'Mendoza 3340',
      contrato: null,
      periodo: '2026-10',
      cuota: null,
      vencimiento: '2026-10-10',
      importe: 1,
      moneda: 'ARS',
      aCargoDe: 'inquilino',
      paga: 'inmobiliaria',
      estado: 'pendiente',
      pagadaEl: null,
      medio: null,
      registradoPor: null,
      aplicada: false,
    };
    expect(BoletaDtoSchema.parse(vieja).cargoRecuperado).toBeNull();
  });
});

describe('regla 51: la cuota se carga «3 de 6», se guarda «3/6» y se lee «cuota 3 de 6»', () => {
  it('regla 51: se muestra «cuota 11 de 12», no «11/12», que se lee como una fecha', () => {
    expect(textoCuota('11/12')).toBe('cuota 11 de 12');
    expect(textoCuota('03/06')).toBe('cuota 3 de 6');
    expect(textoCuota(null)).toBe('');
    // Una cuota vieja con otra forma se muestra tal cual.
    expect(textoCuota('única')).toBe('cuota única');
  });

  it('regla 51: los dos campitos van y vuelven sin cambiar lo que se guarda', () => {
    expect(unirCuota('11', '12')).toBe('11/12');
    expect(CuotaSchema.parse(unirCuota('11', '12'))).toBe('11/12');
    expect(partesDeCuota('11/12')).toEqual({ n: '11', de: '12' });
    expect(partesDeCuota(null)).toEqual({ n: '', de: '' });
    expect(unirCuota('', ' ')).toBeNull();
  });

  it('regla 51: uno solo de los dos, letras o una cuota mayor que el total, es un error', () => {
    expect(unirCuota('3', '')).toBe(false);
    expect(unirCuota('', '6')).toBe(false);
    expect(unirCuota('tres', '6')).toBe(false);
    expect(unirCuota('7', '6')).toBe(false);
    expect(unirCuota('0', '6')).toBe(false);
  });
});
