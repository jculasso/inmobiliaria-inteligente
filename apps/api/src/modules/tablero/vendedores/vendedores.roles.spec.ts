import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Rol } from '@vacker/types';
import { ROLES_KEY } from '../../../auth/decorators';
import { VendedoresController } from './vendedores.controller';

/**
 * La pantalla de Vendedores muestra el equipo con sus objetivos: es
 * información de conducción, no de trabajo diario. Queda en dirección y en el
 * admin de la inmobiliaria.
 *
 * El team leader la tenía y se le sacó el 29/07/2026 por pedido del usuario.
 * Se testea la metadata para que reagregarlo sea una decisión y no un
 * descuido al tocar el controller.
 */
function rolesDe(metodo: keyof VendedoresController): Rol[] {
  const roles = Reflect.getMetadata(ROLES_KEY, VendedoresController.prototype[metodo]) as
    | Rol[]
    | undefined;
  if (!roles) throw new Error(`El handler ${String(metodo)} no declara @Roles.`);
  return roles;
}

describe('RBAC de vendedores', () => {
  const TODOS = ['list', 'create', 'update', 'desactivar', 'setObjetivo', 'subirFoto', 'eliminarFoto'] as const;

  it.each(TODOS)('%s es solo de dirección y admin del tenant', (metodo) => {
    expect([...rolesDe(metodo)].sort()).toEqual(['admin_tenant', 'direccion']);
  });

  it('ni siquiera listar: el team leader ya no ve la pantalla', () => {
    expect(rolesDe('list')).not.toContain('team_leader');
  });

  // La contracara del pedido: que el CEO no dependa del panel de plataforma
  // para cambiar una foto.
  it('cambiar la foto no requiere ser admin de plataforma', () => {
    expect(rolesDe('subirFoto')).toContain('direccion');
    expect(rolesDe('subirFoto')).not.toContain('admin_plataforma');
  });
});
