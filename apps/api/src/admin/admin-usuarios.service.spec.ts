import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { SupabaseAdminService } from './supabase-admin.service';
import { AdminUsuariosService } from './admin-usuarios.service';

const TENANT_ID = 't1';

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: TENANT_ID }),
    },
    usuario: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      ...overrides,
    },
    usuarioRol: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  } as unknown as PrismaService;
}

function makeSupabaseAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    createUser: vi.fn().mockResolvedValue({ id: 'auth-1', email: 'nuevo@vacker.test' }),
    setPassword: vi.fn(),
    deleteUser: vi.fn(),
    ...overrides,
  } as unknown as SupabaseAdminService;
}

const usuarioRow = {
  id: 'auth-1',
  nombre: 'Nueva Vendedora',
  email: 'nuevo@vacker.test',
  estado: 'activo',
  roles: [{ rol: 'vendedor' }],
};

describe('AdminUsuariosService', () => {
  it('create rechaza si el email ya existe en el tenant', async () => {
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue({ id: 'existente' }) });
    const service = new AdminUsuariosService(db, makeSupabaseAdmin());

    await expect(
      service.create(TENANT_ID, {
        nombre: 'X',
        email: 'existente@vacker.test',
        password: 'password123',
        roles: ['vendedor'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create da de alta en Supabase Auth y en la base con el mismo id', async () => {
    const create = vi.fn();
    const findUniqueOrThrow = vi.fn().mockResolvedValue(usuarioRow);
    const db = makeDb({ create, findUniqueOrThrow });
    const supabaseAdmin = makeSupabaseAdmin();
    const service = new AdminUsuariosService(db, supabaseAdmin);

    const result = await service.create(TENANT_ID, {
      nombre: 'Nueva Vendedora',
      email: 'nuevo@vacker.test',
      password: 'password123',
      roles: ['vendedor'],
    });

    expect(supabaseAdmin.createUser).toHaveBeenCalledWith('nuevo@vacker.test', 'password123');
    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'auth-1',
        tenantId: TENANT_ID,
        nombre: 'Nueva Vendedora',
        email: 'nuevo@vacker.test',
        estado: 'activo',
        roles: { create: [{ rol: 'vendedor', tenantId: TENANT_ID }] },
      },
    });
    expect(result).toEqual({
      id: 'auth-1',
      nombre: 'Nueva Vendedora',
      email: 'nuevo@vacker.test',
      estado: 'activo',
      roles: ['vendedor'],
    });
  });

  it('create revierte el alta en Supabase Auth si falla el alta de negocio', async () => {
    const create = vi.fn().mockRejectedValue(new Error('boom'));
    const db = makeDb({ create });
    const supabaseAdmin = makeSupabaseAdmin();
    const service = new AdminUsuariosService(db, supabaseAdmin);

    await expect(
      service.create(TENANT_ID, {
        nombre: 'X',
        email: 'nuevo@vacker.test',
        password: 'password123',
        roles: ['vendedor'],
      }),
    ).rejects.toThrow('boom');

    expect(supabaseAdmin.deleteUser).toHaveBeenCalledWith('auth-1');
  });

  it('resetPassword lanza 404 si el usuario no pertenece al tenant', async () => {
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue(null) });
    const supabaseAdmin = makeSupabaseAdmin();
    const service = new AdminUsuariosService(db, supabaseAdmin);

    await expect(
      service.resetPassword(TENANT_ID, 'auth-1', { password: 'nuevaClave123' }),
    ).rejects.toThrow(NotFoundException);
    expect(supabaseAdmin.setPassword).not.toHaveBeenCalled();
  });

  it('resetPassword actualiza la contraseña vía Supabase Admin', async () => {
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue({ id: 'auth-1' }) });
    const supabaseAdmin = makeSupabaseAdmin();
    const service = new AdminUsuariosService(db, supabaseAdmin);

    const result = await service.resetPassword(TENANT_ID, 'auth-1', { password: 'nuevaClave123' });

    expect(supabaseAdmin.setPassword).toHaveBeenCalledWith('auth-1', 'nuevaClave123');
    expect(result).toEqual({ id: 'auth-1', ok: true });
  });
});
