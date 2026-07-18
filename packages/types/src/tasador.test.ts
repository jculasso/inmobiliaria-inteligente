import { describe, expect, it } from 'vitest';
import { CambiarEstadoSchema } from './tasador';

describe('CambiarEstadoSchema', () => {
  it('rechaza "Captada" sin exclusividad', () => {
    const result = CambiarEstadoSchema.safeParse({ estado: 'Captada' });
    expect(result.success).toBe(false);
  });

  it('acepta "Captada" con exclusividad', () => {
    expect(
      CambiarEstadoSchema.safeParse({
        estado: 'Captada',
        exclusividad: { tipo: 'exclusiva', dias: 60 },
      }).success,
    ).toBe(true);
    expect(
      CambiarEstadoSchema.safeParse({ estado: 'Captada', exclusividad: { tipo: 'no' } }).success,
    ).toBe(true);
  });

  it('rechaza "No captada" sin motivo', () => {
    const result = CambiarEstadoSchema.safeParse({ estado: 'No captada' });
    expect(result.success).toBe(false);
  });

  it('acepta "No captada" con un motivo válido', () => {
    expect(
      CambiarEstadoSchema.safeParse({
        estado: 'No captada',
        motivoNoCaptada: 'Desacuerdo de precio',
      }).success,
    ).toBe(true);
  });

  it('rechaza un motivo que no está en la lista', () => {
    const result = CambiarEstadoSchema.safeParse({ estado: 'No captada', motivoNoCaptada: 'Otro' });
    expect(result.success).toBe(false);
  });

  it('acepta "En proceso" y "Presentada" sin datos extra', () => {
    expect(CambiarEstadoSchema.safeParse({ estado: 'En proceso' }).success).toBe(true);
    expect(CambiarEstadoSchema.safeParse({ estado: 'Presentada' }).success).toBe(true);
  });
});
