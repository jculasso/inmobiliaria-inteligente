import { describe, expect, it } from 'vitest';
import { alcanceDeModulo, etiquetaDeAlcance } from './rbac';

describe('alcanceDeModulo', () => {
  it('vendedor ve su alcance propio', () => {
    expect(alcanceDeModulo(['vendedor'])).toBe('propio');
  });

  it('team_leader ve su equipo', () => {
    expect(alcanceDeModulo(['team_leader'])).toBe('equipo');
  });

  it('dirección ve todo el tenant', () => {
    expect(alcanceDeModulo(['direccion'])).toBe('total');
  });

  it('admin_tenant solo ve', () => {
    expect(alcanceDeModulo(['admin_tenant'])).toBe('ver');
  });

  it('admin_plataforma solo no tiene alcance de tenant', () => {
    expect(alcanceDeModulo(['admin_plataforma'])).toBeNull();
  });

  it('con varios roles, prioriza el más privilegiado', () => {
    expect(alcanceDeModulo(['vendedor', 'direccion'])).toBe('total');
  });
});

describe('etiquetaDeAlcance', () => {
  it('traduce el alcance a texto', () => {
    expect(etiquetaDeAlcance('total')).toBe('Total');
  });
});
