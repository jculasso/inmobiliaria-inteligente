import { describe, expect, it } from 'vitest';
import {
  ConfirmarIndexacionSchema,
  DevolverDepositoSchema,
  IMPORTE_MAXIMO,
  PrevisualizarDiferenciasQuerySchema,
} from './alquileres';
import { FechaIsoSchema, esFechaIsoReal } from './fecha-iso';
import { CobrarSenaSchema } from './reservas';

/**
 * Revisión de seguridad del 15/10/2026: una fecha que no existe o un importe
 * que no entra en la columna llegaban hasta Prisma y la API respondía 500.
 * Tienen que ser un 400 con un mensaje, es decir, fallar acá.
 */
describe('FechaIsoSchema', () => {
  it.each(['2026-13-01', '2026-02-31', '2026-02-29', '2026-04-31', '2026-00-10', '2026-01-00'])(
    '%s no existe: no pasa',
    (f) => {
      expect(esFechaIsoReal(f)).toBe(false);
      expect(FechaIsoSchema.safeParse(f).success).toBe(false);
    },
  );

  it.each(['1899-12-31', '2101-01-01', '0000-01-01', '9999-12-31'])(
    '%s está fuera de rango: no pasa',
    (f) => expect(FechaIsoSchema.safeParse(f).success).toBe(false),
  );

  it.each(['2026-10-15', '2028-02-29', '2000-02-29', '2026-12-31', '1950-05-03', '2100-12-31'])(
    '%s es una fecha real: pasa igual que antes',
    (f) => expect(FechaIsoSchema.parse(f)).toBe(f),
  );

  it('una fecha con otra forma da un solo mensaje, el de siempre', () => {
    const r = FechaIsoSchema.safeParse('15/10/2026');
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toEqual([
      'Fecha inválida, se espera AAAA-MM-DD.',
    ]);
  });

  it('la usan los schemas del módulo: el de Alquileres y el de la reserva', () => {
    expect(DevolverDepositoSchema.safeParse({ fecha: '2026-02-31' }).success).toBe(false);
    expect(DevolverDepositoSchema.safeParse({ fecha: '2026-02-28' }).success).toBe(true);
    const sena = { fecha: '2026-13-01', medio: 'efectivo', personaId: null, obs: null };
    expect(CobrarSenaSchema.safeParse(sena).success).toBe(false);
    expect(CobrarSenaSchema.safeParse({ ...sena, fecha: '2026-10-15' }).success).toBe(true);
  });
});

describe('Importes de la indexación, con el tope de Decimal(14, 2)', () => {
  it('confirmar: hasta el máximo de la columna, y ni un centavo más', () => {
    expect(ConfirmarIndexacionSchema.parse({ importe: IMPORTE_MAXIMO })).toEqual({
      importe: IMPORTE_MAXIMO,
    });
    expect(ConfirmarIndexacionSchema.safeParse({ importe: 1e15 }).success).toBe(false);
    expect(ConfirmarIndexacionSchema.parse({})).toEqual({ importe: null });
  });

  it('la vista previa: el importe del query string, con el mismo tope', () => {
    expect(PrevisualizarDiferenciasQuerySchema.parse({ importe: '1000000' })).toEqual({
      importe: 1_000_000,
    });
    expect(PrevisualizarDiferenciasQuerySchema.safeParse({ importe: '1e15' }).success).toBe(false);
    expect(PrevisualizarDiferenciasQuerySchema.parse({})).toEqual({ importe: null });
  });
});
