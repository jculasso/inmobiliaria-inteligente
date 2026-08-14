import { describe, expect, it } from 'vitest';
import { TenantConfigSchema, configPorDefecto } from './tenant';

describe('el criterio de tasación de una inmobiliaria', () => {
  /*
   * De esto depende que este cambio no haya tocado un solo dato: si una
   * inmobiliaria que nunca configuró nada calcula como Vacker, entonces las
   * tasaciones que ya existían siguen dando el mismo número y no hay migración
   * de datos que hacer.
   */
  it('sin configurar nada, se calcula como Vacker', () => {
    expect(TenantConfigSchema.parse({})).toMatchObject({
      coefSemicubierta: 1,
      coefDescubierta: 0.3,
    });
    expect(configPorDefecto()).toMatchObject({ coefSemicubierta: 1, coefDescubierta: 0.3 });
  });

  it('conserva lo que sí se configuró', () => {
    expect(TenantConfigSchema.parse({ coefDescubierta: 0.5 })).toMatchObject({
      coefSemicubierta: 1,
      coefDescubierta: 0.5,
    });
  });

  it('no acepta un coeficiente mayor que uno', () => {
    // Un metro semicubierto que valiera más que uno cubierto no es un criterio
    // de tasación, es un error de carga — y multiplicaría la valuación.
    expect(TenantConfigSchema.safeParse({ coefSemicubierta: 1.5 }).success).toBe(false);
    expect(TenantConfigSchema.safeParse({ coefDescubierta: 30 }).success).toBe(false);
  });

  it('no acepta un coeficiente negativo', () => {
    expect(TenantConfigSchema.safeParse({ coefDescubierta: -0.1 }).success).toBe(false);
  });
});
