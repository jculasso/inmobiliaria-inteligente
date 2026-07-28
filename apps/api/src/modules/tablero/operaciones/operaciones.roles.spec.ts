import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { Rol } from '@vacker/types';
import { ROLES_KEY } from '../../../auth/decorators';
import { OperacionesController } from './operaciones.controller';

/**
 * Quién puede cargar operaciones es una regla de NEGOCIO que ya se dio vuelta
 * una vez: hasta el 28/07/2026 el vendedor y el team leader también cargaban
 * —decisión deliberada, incluso documentada como "no es un bug"— y se revirtió
 * para que los números del tablero tengan un único origen.
 *
 * Por eso se testea la metadata del controller y no solo el guard: si alguien
 * vuelve a agregar 'vendedor' al @Roles de un POST creyendo que restaura algo
 * roto, esto se pone en rojo y lo obliga a leer el porqué.
 */
function rolesDe(metodo: keyof OperacionesController): Rol[] {
  const roles = Reflect.getMetadata(ROLES_KEY, OperacionesController.prototype[metodo]) as
    | Rol[]
    | undefined;
  if (!roles) throw new Error(`El handler ${String(metodo)} no declara @Roles.`);
  return roles;
}

describe('RBAC de operaciones', () => {
  const ESCRITURA = ['create', 'update', 'remove'] as const;
  const LECTURA = ['list', 'getOne'] as const;

  it.each(ESCRITURA)('%s es solo de dirección y admin del tenant', (metodo) => {
    expect([...rolesDe(metodo)].sort()).toEqual(['admin_tenant', 'direccion']);
  });

  it.each(ESCRITURA)('%s no lo puede hacer un vendedor ni un team leader', (metodo) => {
    const roles = rolesDe(metodo);
    expect(roles).not.toContain('vendedor');
    expect(roles).not.toContain('team_leader');
  });

  // La contracara: restringir la carga NO puede dejar ciego al vendedor. Sus
  // KPIs, su ranking y sus objetivos salen de estas mismas operaciones.
  it.each(LECTURA)('%s la sigue pudiendo hacer todo el mundo en su alcance', (metodo) => {
    expect([...rolesDe(metodo)].sort()).toEqual([
      'admin_tenant',
      'direccion',
      'team_leader',
      'vendedor',
    ]);
  });
});
