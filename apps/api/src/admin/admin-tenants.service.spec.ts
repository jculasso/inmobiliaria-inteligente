import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseStorageService } from '../common/supabase-storage.service';
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

// No se ejercita la subida de logo en estos tests (ver admin-usuarios.service.spec.ts
// para el caso que sí mockea Storage) — alcanza con un stub para satisfacer el constructor.
const storage = {} as SupabaseStorageService;

describe('AdminTenantsService', () => {
  it('list devuelve todas las inmobiliarias ordenadas por nombre', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 't1', nombre: 'Vacker' }]);
    const db = makeDb({ findMany });
    const service = new AdminTenantsService(db, storage);

    const result = await service.list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { nombre: 'asc' } });
    expect(result).toEqual([{ id: 't1', nombre: 'Vacker' }]);
  });

  it('create rechaza un slug duplicado', async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue({ id: 't1' }) });
    const service = new AdminTenantsService(db, storage);

    await expect(
      service.create({ nombre: 'Otra', slug: 'vacker', plan: 'basico' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create da de alta la inmobiliaria con slug libre', async () => {
    const create = vi.fn().mockResolvedValue({ id: 't2', nombre: 'Otra', slug: 'otra' });
    const db = makeDb({ create });
    const service = new AdminTenantsService(db, storage);

    const result = await service.create({ nombre: 'Otra', slug: 'otra', plan: 'basico' });

    expect(create).toHaveBeenCalledWith({
      data: { nombre: 'Otra', slug: 'otra', plan: 'basico', config: {} },
    });
    expect(result.slug).toBe('otra');
  });

  it('update lanza 404 si la inmobiliaria no existe', async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue(null) });
    const service = new AdminTenantsService(db, storage);

    await expect(service.update('nope', { estado: 'suspendido' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update aplica los cambios', async () => {
    const update = vi.fn().mockResolvedValue({ id: 't1', estado: 'suspendido' });
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue({ id: 't1' }), update });
    const service = new AdminTenantsService(db, storage);

    const result = await service.update('t1', { estado: 'suspendido' });

    expect(update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { estado: 'suspendido' } });
    expect(result.estado).toBe('suspendido');
  });

  it('update rechaza cambiar el slug a uno ya usado por otro tenant', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: 't1', slug: 'vieja' }) // lookup del propio tenant
      .mockResolvedValueOnce({ id: 't2', slug: 'nueva' }); // lookup del slug nuevo, ya tomado
    const db = makeDb({ findUnique });
    const service = new AdminTenantsService(db, storage);

    await expect(service.update('t1', { slug: 'nueva' })).rejects.toThrow(BadRequestException);
  });

  it('update mergea config en vez de reemplazarlo', async () => {
    const update = vi.fn().mockResolvedValue({ id: 't1' });
    const db = makeDb({
      findUnique: vi.fn().mockResolvedValue({ id: 't1', slug: 'vacker', config: { logoUrl: 'https://x/logo.png' } }),
      update,
    });
    const service = new AdminTenantsService(db, storage);

    await service.update('t1', { config: { colorPrimario: '#123456' } });

    expect(update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { config: { logoUrl: 'https://x/logo.png', colorPrimario: '#123456' } },
    });
  });
});
