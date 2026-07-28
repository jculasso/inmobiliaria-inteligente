import type { Prisma } from '@prisma/client';
import type { Rol } from '@vacker/types';
import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../prisma/tenant-context';
import { modoDeScope, scopeDePermiso, scopeDeVista } from './scope.util';

function ctx(roles: Rol[], userId = 'u1'): TenantContext {
  return { tenantId: 't1', userId, roles };
}

function txVacio() {
  const findMany = vi.fn();
  return { tx: { usuario: { findMany } } as unknown as Prisma.TransactionClient, findMany };
}

describe('modoDeScope', () => {
  it('dirección/admin ven todo el tenant', () => {
    expect(modoDeScope(['direccion'])).toBe('tenant');
    expect(modoDeScope(['admin_tenant'])).toBe('tenant');
    expect(modoDeScope(['admin_plataforma'])).toBe('tenant');
  });

  it('team_leader ve su equipo; vendedor solo lo propio', () => {
    expect(modoDeScope(['team_leader'])).toBe('equipo');
    expect(modoDeScope(['vendedor'])).toBe('propio');
  });

  it('el alcance más amplio gana ante roles combinados', () => {
    expect(modoDeScope(['vendedor', 'team_leader'])).toBe('equipo');
    expect(modoDeScope(['vendedor', 'direccion'])).toBe('tenant');
  });
});

/**
 * VISTA — qué se muestra en pantalla.
 *
 * El default es lo propio para todos, y el check "Ver todo" expande al máximo
 * del rol. Hasta el 28/07/2026 era exactamente al revés, así que estos tests
 * son la defensa contra volver atrás sin querer.
 */
describe('scopeDeVista — sin "Ver todo" (el default)', () => {
  it.each([['direccion'], ['team_leader'], ['vendedor']] as const)(
    '%s entra viendo solo lo suyo',
    async (rol) => {
      const { tx, findMany } = txVacio();
      expect(await scopeDeVista(ctx([rol], 'u7'), tx)).toEqual({
        mode: 'propio',
        usuarioIds: ['u7'],
      });
      // Ni siquiera consulta el equipo: el alcance propio no lo necesita.
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it('el admin es la excepción: siempre ve todo', async () => {
    // No tiene puntas propias; arrancarlo en "lo mío" sería una pantalla vacía.
    const { tx, findMany } = txVacio();
    expect(await scopeDeVista(ctx(['admin_tenant']), tx)).toEqual({
      mode: 'tenant',
      usuarioIds: null,
    });
    expect(await scopeDeVista(ctx(['admin_plataforma']), tx)).toEqual({
      mode: 'tenant',
      usuarioIds: null,
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('scopeDeVista — con "Ver todo"', () => {
  it('dirección pasa a ver toda la inmobiliaria', async () => {
    const { tx, findMany } = txVacio();
    expect(await scopeDeVista(ctx(['direccion']), tx, true)).toEqual({
      mode: 'tenant',
      usuarioIds: null,
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('el team leader pasa a ver su equipo: él + sus vendedores', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'lead' }, { id: 'v1' }, { id: 'v2' }]);
    const tx = { usuario: { findMany } } as unknown as Prisma.TransactionClient;
    const scope = await scopeDeVista(ctx(['team_leader'], 'lead'), tx, true);
    expect(scope.mode).toBe('equipo');
    expect(scope.usuarioIds).toEqual(['lead', 'v1', 'v2']);
    expect(findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: 'lead' }, { liderId: 'lead' }] },
      select: { id: true },
    });
  });

  it('el check NO agranda el alcance más allá del rol', async () => {
    // `verTodo` llega por query param, o sea que lo controla el cliente: si un
    // vendedor lo manda a mano, no puede aparecerle nada ajeno.
    const { tx, findMany } = txVacio();
    expect(await scopeDeVista(ctx(['vendedor'], 'v9'), tx, true)).toEqual({
      mode: 'propio',
      usuarioIds: ['v9'],
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

/**
 * PERMISO — qué puede tocar el usuario.
 *
 * Deliberadamente NO sigue al check de la pantalla. Separar las dos preguntas
 * fue lo que evitó el bug al invertir el default: si el permiso hubiera
 * heredado la vista, un CEO mirando "lo mío" habría dejado de poder abrir la
 * operación de cualquier otro.
 */
describe('scopeDePermiso', () => {
  it('dirección puede tocar todo el tenant aunque la pantalla muestre lo suyo', async () => {
    const { tx } = txVacio();
    expect(await scopeDePermiso(ctx(['direccion']), tx)).toEqual({
      mode: 'tenant',
      usuarioIds: null,
    });
  });

  it('el team leader puede tocar lo de su equipo', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'lead' }, { id: 'v1' }]);
    const tx = { usuario: { findMany } } as unknown as Prisma.TransactionClient;
    const scope = await scopeDePermiso(ctx(['team_leader'], 'lead'), tx);
    expect(scope.mode).toBe('equipo');
    expect(scope.usuarioIds).toEqual(['lead', 'v1']);
  });

  it('el vendedor sigue limitado a lo suyo', async () => {
    const { tx } = txVacio();
    expect(await scopeDePermiso(ctx(['vendedor'], 'v9'), tx)).toEqual({
      mode: 'propio',
      usuarioIds: ['v9'],
    });
  });
});
