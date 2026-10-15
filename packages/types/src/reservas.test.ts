import { describe, expect, it } from 'vitest';
import {
  CambioEstadoReservaSchema,
  ESTADOS_RESERVA_ABIERTOS,
  EstadoReservaSchema,
  FiltroReservasSchema,
  CobrarSenaSchema,
  ESTADOS_QUE_RETIENEN_LA_SENA,
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

  it('la seña sin moneda va en la del alquiler; el depósito, igual', () => {
    const r = ReservaInputSchema.parse({
      ...base,
      moneda: 'USD',
      senaImporte: 500,
      depositoImporte: 1000,
    });
    expect(r).toMatchObject({ senaMoneda: 'USD', depositoMoneda: 'USD' });
    expect(ReservaInputSchema.parse(base).senaMoneda).toBeNull();
  });

  it('regla 169: cobrar la seña pide la fecha; el medio, si no se dice, es transferencia', () => {
    expect(CobrarSenaSchema.safeParse({}).success).toBe(false);
    expect(CobrarSenaSchema.parse({ fecha: '2026-10-15' })).toEqual({
      fecha: '2026-10-15',
      medio: 'transferencia',
      personaId: null,
      obs: null,
    });
  });

  it('la misma persona dos veces con el mismo papel no entra', () => {
    expect(mensajes({ ...base, partes: [...base.partes, ...base.partes] })).toEqual([
      'La misma persona está dos veces con el mismo papel.',
    ]);
  });
});

describe('Estados de la reserva (regla 155)', () => {
  it('los finales no tienen pasos; convertida solo llega desde aprobada', () => {
    for (const e of ['convertida', 'rechazada', 'vencida', 'no_se_presento', 'anulada'] as const)
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

describe('La seña retenida (regla 171)', () => {
  it('se retiene al rechazar, al vencer y si no se presentó a firmar; no al anular', () => {
    expect([...ESTADOS_QUE_RETIENEN_LA_SENA]).toEqual(['rechazada', 'vencida', 'no_se_presento']);
    // «No se presentó a firmar» es el cierre de una aprobada.
    expect(PASOS_RESERVA.aprobada).toContain('no_se_presento');
    expect(PASOS_RESERVA.en_estudio).not.toContain('no_se_presento');
  });

  it('«no se presentó» no pide motivo; cerrar puede traer el propietario a quien entregar la seña', () => {
    expect(CambioEstadoReservaSchema.parse({ estado: 'no_se_presento' })).toEqual({
      estado: 'no_se_presento',
    });
    expect(
      CambioEstadoReservaSchema.safeParse({ estado: 'vencida', propietarioId: 'no-es-un-id' })
        .success,
    ).toBe(false);
  });
});
