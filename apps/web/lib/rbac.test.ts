import { describe, expect, it } from 'vitest';
import {
  alcanceDeModulo,
  etiquetaDeAlcance,
  puedeEscribirOperaciones,
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

describe('puedeEscribirOperaciones', () => {
  it('la carga la centraliza la inmobiliaria: solo dirección y admin', () => {
    expect(puedeEscribirOperaciones(['direccion'])).toBe(true);
    expect(puedeEscribirOperaciones(['admin_tenant'])).toBe(true);
  });

  // Hasta el 28/07/2026 estos dos cargaban, y era intencional. Se revirtió por
  // decisión de negocio; el test deja constancia de que hoy NO es un descuido.
  it('ni el vendedor ni el team leader cargan operaciones', () => {
    expect(puedeEscribirOperaciones(['vendedor'])).toBe(false);
    expect(puedeEscribirOperaciones(['team_leader'])).toBe(false);
  });

  it('un team leader que además es dirección sí puede', () => {
    expect(puedeEscribirOperaciones(['team_leader', 'direccion'])).toBe(true);
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
