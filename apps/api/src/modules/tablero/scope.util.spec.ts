import type { Prisma } from '@prisma/client';
import type { Rol } from '@vacker/types';
import { describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../prisma/tenant-context';
import { modoDeScope, resolverScope } from './scope.util';

function ctx(roles: Rol[], userId = 'u1'): TenantContext {
  return { tenantId: 't1', userId, roles };
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

describe('resolverScope', () => {
  it('tenant: usuarioIds null (sin consultar la base)', async () => {
    const findMany = vi.fn();
    const tx = { usuario: { findMany } } as unknown as Prisma.TransactionClient;
    const scope = await resolverScope(ctx(['direccion']), tx);
    expect(scope).toEqual({ mode: 'tenant', usuarioIds: null });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('propio: solo el userId (sin consultar la base)', async () => {
    const findMany = vi.fn();
    const tx = { usuario: { findMany } } as unknown as Prisma.TransactionClient;
    const scope = await resolverScope(ctx(['vendedor'], 'v9'), tx);
    expect(scope).toEqual({ mode: 'propio', usuarioIds: ['v9'] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('equipo: líder + sus vendedores (lider_id = él)', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'lead' }, { id: 'v1' }, { id: 'v2' }]);
    const tx = { usuario: { findMany } } as unknown as Prisma.TransactionClient;
    const scope = await resolverScope(ctx(['team_leader'], 'lead'), tx);
    expect(scope.mode).toBe('equipo');
    expect(scope.usuarioIds).toEqual(['lead', 'v1', 'v2']);
    expect(findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: 'lead' }, { liderId: 'lead' }] },
      select: { id: true },
    });
  });
});
