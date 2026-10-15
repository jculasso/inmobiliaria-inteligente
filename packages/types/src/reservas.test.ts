import { describe, expect, it } from 'vitest';
import {
  CambioEstadoReservaSchema,
  ESTADOS_RESERVA_ABIERTOS,
  EstadoReservaSchema,
  FiltroReservasSchema,
  PASOS_RESERVA,
  ReservaInputSchema,
  type ReservaInput,
} from './reservas';

const ANA = '44444444-4444-4444-8444-444444444444';
const base: ReservaInput = {
  propiedadId: '33333333-3333-4333-8333-333333333333',
  fecha: '2026-10-15',
  vence: '2026-10-22',
  partes: [{ personaId: ANA, papel: 'inquilino' }],
};
const mensajes = (x: unknown) => {
  const r = ReservaInputSchema.safeParse(x);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('ReservaInputSchema (regla 154)', () => {
  it('lo mínimo: propiedad, fechas y el interesado; las condiciones pueden faltar', () => {
    const r = ReservaInputSchema.parse(base);
    expect(r).toMatchObject({
      tipo: 'vivienda',
      moneda: 'ARS',
      alquilerInicial: null,
      senaImporte: null,
      senaRecibida: false,
    });
  });

  it('sin interesado, o con el vencimiento antes de la fecha, dice qué falta', () => {
    expect(mensajes({ ...base, partes: [] })).toEqual([
      'Falta el interesado (el futuro inquilino).',
    ]);
    expect(mensajes({ ...base, vence: '2026-10-14' })).toEqual([
      'El vencimiento no puede ser anterior a la fecha de la reserva.',
    ]);
  });

  it('una seña recibida pide cuándo y cómo', () => {
    expect(mensajes({ ...base, senaImporte: 500, senaRecibida: true })).toEqual([
      'Indicá cuándo y cómo se recibió la seña.',
    ]);
    const r = ReservaInputSchema.parse({
      ...base,
      senaImporte: 500,
      senaRecibida: true,
      senaRecibidaEl: '2026-10-15',
      senaMedio: 'efectivo',
    });
    // Sin moneda, la del alquiler.
    expect(r).toMatchObject({ senaMoneda: 'ARS', senaRecibida: true, senaMedio: 'efectivo' });
  });

  it('sin importe de seña no queda nada «recibido»; el depósito sin moneda va en la del alquiler', () => {
    const r = ReservaInputSchema.parse({
      ...base,
      moneda: 'USD',
      senaRecibida: false,
      senaMedio: 'cheque',
      depositoImporte: 1000,
    });
    expect(r).toMatchObject({ senaMoneda: null, senaMedio: null, depositoMoneda: 'USD' });
  });

  it('la misma persona dos veces con el mismo papel no entra', () => {
    expect(mensajes({ ...base, partes: [...base.partes, ...base.partes] })).toEqual([
      'La misma persona está dos veces con el mismo papel.',
    ]);
  });
});

describe('Estados de la reserva (regla 155)', () => {
  it('los finales no tienen pasos; convertida solo llega desde aprobada', () => {
    for (const e of ['convertida', 'rechazada', 'vencida', 'anulada'] as const)
      expect(PASOS_RESERVA[e]).toEqual([]);
    const llegan = EstadoReservaSchema.options.filter((e) =>
      PASOS_RESERVA[e].includes('convertida'),
    );
    expect(llegan).toEqual(['aprobada']);
    expect(PASOS_RESERVA.reservada).not.toContain('aprobada');
    expect(PASOS_RESERVA.en_estudio).toContain('aprobada');
  });

  it('las abiertas son las que tienen pasos hacia adelante', () => {
    expect([...ESTADOS_RESERVA_ABIERTOS]).toEqual(
      EstadoReservaSchema.options.filter((e) => PASOS_RESERVA[e].length > 0),
    );
  });

  it('rechazar y anular piden motivo; los demás pasos no', () => {
    expect(CambioEstadoReservaSchema.safeParse({ estado: 'rechazada' }).success).toBe(false);
    expect(CambioEstadoReservaSchema.safeParse({ estado: 'anulada', motivo: 'x' }).success).toBe(
      false,
    );
    expect(CambioEstadoReservaSchema.safeParse({ estado: 'aprobada' }).success).toBe(true);
    // `convertida` no es un cambio de estado: llega al guardar el contrato (regla 159).
    expect(CambioEstadoReservaSchema.safeParse({ estado: 'convertida' }).success).toBe(false);
  });

  it('el filtro de la lista abre en las abiertas y lo que no se entiende vuelve ahí', () => {
    expect(FiltroReservasSchema.parse(undefined)).toBe('abiertas');
    expect(FiltroReservasSchema.parse('cualquiera')).toBe('abiertas');
    expect(FiltroReservasSchema.parse('vencida')).toBe('vencida');
    expect(FiltroReservasSchema.parse('todas')).toBe('todas');
  });
});
