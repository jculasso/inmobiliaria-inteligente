import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { ModuloKey, Rol } from '@vacker/types';
import { MODULO_KEY, ROLES_KEY } from '../../auth/decorators';
import { PublicacionController } from './publicacion.controller';

/**
 * El módulo se contrata por inmobiliaria Y además pide un rol funcional.
 *
 * Las dos cosas importan y son independientes: sin el módulo contratado no
 * entra nadie, y con el módulo contratado entra solo quien publica. Si se
 * olvidara el `@Modulo`, el módulo quedaría abierto para cualquier inmobiliaria
 * aunque la Home no le muestre la tarjeta — pasó antes en este proyecto.
 */
describe('RBAC del módulo de Publicación', () => {
  const HANDLERS = ['estado', 'guardar', 'borrar', 'probar'] as const;

  it('el controller exige tener contratado el módulo', () => {
    const modulo = Reflect.getMetadata(MODULO_KEY, PublicacionController) as ModuloKey | undefined;
    expect(modulo).toBe('publicacion');
  });

  it.each(HANDLERS)('%s lo puede hacer el publicador y el admin del tenant', (metodo) => {
    const roles = Reflect.getMetadata(ROLES_KEY, PublicacionController.prototype[metodo]) as Rol[];
    expect([...roles].sort()).toEqual(['admin_tenant', 'publicador']);
  });

  // Publicar no es una tarea de conducción: dirección no entra por ser
  // dirección. Sumar el rol a quien lo necesite es un click en /admin.
  it.each(HANDLERS)('%s NO lo abre por ser dirección ni vendedor', (metodo) => {
    const roles = Reflect.getMetadata(ROLES_KEY, PublicacionController.prototype[metodo]) as Rol[];
    expect(roles).not.toContain('direccion');
    expect(roles).not.toContain('vendedor');
    expect(roles).not.toContain('team_leader');
  });
});
