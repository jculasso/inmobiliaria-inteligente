import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RolAsignableSchema, type CreateVendedor, type UpdateVendedor } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import type { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { VendedoresService } from './vendedores.service';

const CTX: TenantContext = { tenantId: 't1', userId: 'admin', roles: ['admin_tenant'] };

function makeTx(over: Record<string, unknown> = {}) {
  return {
    usuario: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    usuarioRol: { deleteMany: vi.fn(), createMany: vi.fn() },
    objetivo: { upsert: vi.fn() },
    ...over,
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

const vendedorRow = {
  id: 'u1',
  nombre: 'Ana',
  email: 'ana@vacker.test',
  fotoUrl: null,
  estado: 'activo',
  liderId: null,
  lider: null,
  roles: [{ rol: 'vendedor' }],
  objetivos: [],
};

describe('VendedoresService', () => {
  it('create: rechaza si el email ya existe en el tenant', async () => {
    const tx = makeTx({
      usuario: { findFirst: vi.fn().mockResolvedValue({ id: 'existente' }), findUniqueOrThrow: vi.fn() },
    });
    const svc = new VendedoresService(makeDb(tx));

    await expect(
      svc.create({ nombre: 'X', email: 'ana@vacker.test', estado: 'activo', roles: ['vendedor'] } as unknown as CreateVendedor, CTX),
    ).rejects.toThrow(BadRequestException);
  });

  it('update: un usuario no puede ser su propio líder', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi.fn().mockResolvedValue({ id: 'u1', email: 'ana@vacker.test' });
    const svc = new VendedoresService(makeDb(tx));

    await expect(
      svc.update('u1', { liderId: 'u1' } as unknown as UpdateVendedor, CTX),
    ).rejects.toThrow(BadRequestException);
  });

  it('update de roles NO borra admin_plataforma (solo reemplaza roles asignables)', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi.fn().mockResolvedValue({ id: 'u1', email: 'ana@vacker.test' });
    tx.usuario.findUniqueOrThrow = vi.fn().mockResolvedValue(vendedorRow);
    const svc = new VendedoresService(makeDb(tx));

    await svc.update('u1', { roles: ['vendedor'] } as unknown as UpdateVendedor, CTX);

    expect(tx.usuarioRol.deleteMany).toHaveBeenCalledTimes(1);
    const arg = tx.usuarioRol.deleteMany.mock.calls[0]![0] as { where: { rol: { in: string[] } } };
    // El deleteMany se acota a los roles asignables desde el formulario…
    expect(arg.where.rol.in).toEqual([...RolAsignableSchema.options]);
    // …y por lo tanto NUNCA toca admin_plataforma.
    expect(arg.where.rol.in).not.toContain('admin_plataforma');
  });
});
