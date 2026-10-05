import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_ADMINISTRACION_ALQUILERES, type ModuloKey, type Rol } from '@vacker/types';
import { MODULO_KEY, ROLES_KEY } from '../../auth/decorators';
import { AlquileresController } from './alquileres.controller';

/**
 * Spec alquileres-fase-1.md §3: el módulo se contrata por inmobiliaria Y pide
 * uno de tres roles. Las dos llaves son independientes.
 */
describe('RBAC del módulo Alquileres', () => {
  const HANDLERS = ['resumen'] as const;

  it('el controller exige tener contratado el módulo', () => {
    expect(Reflect.getMetadata(MODULO_KEY, AlquileresController) as ModuloKey).toBe('alquileres');
  });

  it.each(HANDLERS)('%s usa exactamente ROLES_ADMINISTRACION_ALQUILERES', (metodo) => {
    const roles = Reflect.getMetadata(ROLES_KEY, AlquileresController.prototype[metodo]) as Rol[];
    expect([...roles].sort()).toEqual([...ROLES_ADMINISTRACION_ALQUILERES].sort());
  });

  it.each(HANDLERS)('%s no lo abre a vendedores, team leaders ni publicadores', (metodo) => {
    const roles = Reflect.getMetadata(ROLES_KEY, AlquileresController.prototype[metodo]) as Rol[];
    expect(roles).not.toContain('vendedor');
    expect(roles).not.toContain('team_leader');
    expect(roles).not.toContain('publicador');
  });
});
