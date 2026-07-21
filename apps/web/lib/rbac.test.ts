import { describe, expect, it } from 'vitest';
import {
  alcanceDeModulo,
  etiquetaDeAlcance,
  puedeBorrarOperaciones,
  puedeBorrarTasaciones,
  puedeGestionarVendedores,
  puedeVerVendedores,
  rolPrincipal,
} from './rbac';

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

describe('rolPrincipal', () => {
  it('prioriza dirección sobre el resto', () => {
    expect(rolPrincipal(['vendedor', 'direccion'])).toBe('direccion');
  });

  it('devuelve null si ningún rol tiene alcance de tenant', () => {
    expect(rolPrincipal(['admin_plataforma'])).toBeNull();
  });
});

describe('puedeVerVendedores', () => {
  it('un vendedor puro no puede', () => {
    expect(puedeVerVendedores(['vendedor'])).toBe(false);
  });

  it('team_leader, direccion y admin_tenant sí pueden', () => {
    expect(puedeVerVendedores(['team_leader'])).toBe(true);
    expect(puedeVerVendedores(['direccion'])).toBe(true);
    expect(puedeVerVendedores(['admin_tenant'])).toBe(true);
  });

  it('admin_plataforma solo no puede', () => {
    expect(puedeVerVendedores(['admin_plataforma'])).toBe(false);
  });
});

describe('puedeGestionarVendedores', () => {
  it('solo direccion y admin_tenant pueden dar de alta/editar/borrar vendedores', () => {
    expect(puedeGestionarVendedores(['direccion'])).toBe(true);
    expect(puedeGestionarVendedores(['admin_tenant'])).toBe(true);
    expect(puedeGestionarVendedores(['team_leader'])).toBe(false);
    expect(puedeGestionarVendedores(['vendedor'])).toBe(false);
  });
});

describe('puedeBorrarOperaciones', () => {
  it('un vendedor puro no puede borrar operaciones', () => {
    expect(puedeBorrarOperaciones(['vendedor'])).toBe(false);
  });

  it('team_leader, direccion y admin_tenant sí pueden', () => {
    expect(puedeBorrarOperaciones(['team_leader'])).toBe(true);
    expect(puedeBorrarOperaciones(['direccion'])).toBe(true);
    expect(puedeBorrarOperaciones(['admin_tenant'])).toBe(true);
  });
});

describe('puedeBorrarTasaciones', () => {
  it('un vendedor puro no puede borrar tasaciones', () => {
    expect(puedeBorrarTasaciones(['vendedor'])).toBe(false);
  });

  it('team_leader, direccion y admin_tenant sí pueden', () => {
    expect(puedeBorrarTasaciones(['team_leader'])).toBe(true);
    expect(puedeBorrarTasaciones(['direccion'])).toBe(true);
    expect(puedeBorrarTasaciones(['admin_tenant'])).toBe(true);
  });
});
