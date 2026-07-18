import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminTenantsService } from './admin-tenants.service';

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tenant: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      ...overrides,
    },
  } as unknown as PrismaService;
}

describe('AdminTenantsService', () => {
  it('list devuelve todas las inmobiliarias ordenadas por nombre', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 't1', nombre: 'Vacker' }]);
    const db = makeDb({ findMany });
    const service = new AdminTenantsService(db);

    const result = await service.list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { nombre: 'asc' } });
    expect(result).toEqual([{ id: 't1', nombre: 'Vacker' }]);
  });

  it('create rechaza un slug duplicado', async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue({ id: 't1' }) });
    const service = new AdminTenantsService(db);

    await expect(
      service.create({ nombre: 'Otra', slug: 'vacker', plan: 'basico' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create da de alta la inmobiliaria con slug libre', async () => {
    const create = vi.fn().mockResolvedValue({ id: 't2', nombre: 'Otra', slug: 'otra' });
    const db = makeDb({ create });
    const service = new AdminTenantsService(db);

    const result = await service.create({ nombre: 'Otra', slug: 'otra', plan: 'basico' });

    expect(create).toHaveBeenCalledWith({
      data: { nombre: 'Otra', slug: 'otra', plan: 'basico' },
    });
    expect(result.slug).toBe('otra');
  });

  it('update lanza 404 si la inmobiliaria no existe', async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue(null) });
    const service = new AdminTenantsService(db);

    await expect(service.update('nope', { estado: 'suspendido' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update aplica los cambios', async () => {
    const update = vi.fn().mockResolvedValue({ id: 't1', estado: 'suspendido' });
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue({ id: 't1' }), update });
    const service = new AdminTenantsService(db);

    const result = await service.update('t1', { estado: 'suspendido' });

    expect(update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { estado: 'suspendido' } });
    expect(result.estado).toBe('suspendido');
  });
});
