import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RolAsignableSchema, type CreateVendedor, type UpdateVendedor } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import type { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import type { SupabaseAdminService } from '../../../admin/supabase-admin.service';
import type { PrincipalCacheService } from '../../../auth/principal-cache.service';
import { VendedoresService } from './vendedores.service';

/** Editar el email acá también lo cambia en Supabase Auth (es el del login). */
function makeSupabaseAdmin() {
  return { setEmail: vi.fn() } as unknown as SupabaseAdminService & { setEmail: ReturnType<typeof vi.fn> };
}

function makeCache() {
  return { invalidarUsuario: vi.fn() } as unknown as PrincipalCacheService;
}

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

/** Storage mockeado: devuelve una URL como la que da Supabase. */
function makeStorage(over: Record<string, unknown> = {}) {
  return {
    upload: vi.fn().mockResolvedValue('https://storage.test/usuarios-avatares/t1/u1.jpg'),
    remove: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as ConstructorParameters<typeof VendedoresService>[3];
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
    const svc = new VendedoresService(makeDb(tx), makeSupabaseAdmin(), makeCache(), makeStorage());

    await expect(
      svc.create({ nombre: 'X', email: 'ana@vacker.test', estado: 'activo', roles: ['vendedor'] } as unknown as CreateVendedor, CTX),
    ).rejects.toThrow(BadRequestException);
  });

  it('update: un usuario no puede ser su propio líder', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi.fn().mockResolvedValue({ id: 'u1', email: 'ana@vacker.test' });
    const svc = new VendedoresService(makeDb(tx), makeSupabaseAdmin(), makeCache(), makeStorage());

    await expect(
      svc.update('u1', { liderId: 'u1' } as unknown as UpdateVendedor, CTX),
    ).rejects.toThrow(BadRequestException);
  });

  it('cambiar el email acá también lo cambia en Supabase Auth (es el del login)', async () => {
    // Regresión: se editaba solo nuestra tabla, así que la persona seguía
    // teniendo que entrar con el mail viejo, sin ninguna pista de por qué.
    const tx = makeTx();
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'viejo@vacker.com', authUserId: 'auth-1' });
    tx.usuario.findUniqueOrThrow = vi.fn().mockResolvedValue(vendedorRow);
    const supabaseAdmin = makeSupabaseAdmin();
    const svc = new VendedoresService(makeDb(tx), supabaseAdmin, makeCache(), makeStorage());

    await svc.update('u1', { email: 'nuevo@vacker.com.ar' } as unknown as UpdateVendedor, CTX);

    expect(supabaseAdmin.setEmail).toHaveBeenCalledWith('auth-1', 'nuevo@vacker.com.ar');
  });

  it('si el vendedor todavía no tiene acceso, no se toca Auth', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'viejo@vacker.com', authUserId: null });
    tx.usuario.findUniqueOrThrow = vi.fn().mockResolvedValue(vendedorRow);
    const supabaseAdmin = makeSupabaseAdmin();
    const svc = new VendedoresService(makeDb(tx), supabaseAdmin, makeCache(), makeStorage());

    await svc.update('u1', { email: 'nuevo@vacker.com.ar' } as unknown as UpdateVendedor, CTX);

    expect(supabaseAdmin.setEmail).not.toHaveBeenCalled();
  });

  it('si Auth rechaza el email, no se guarda el cambio en la base', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'viejo@vacker.com', authUserId: 'auth-1' });
    const supabaseAdmin = makeSupabaseAdmin();
    supabaseAdmin.setEmail.mockRejectedValue(new BadRequestException('Email ya usado'));
    const svc = new VendedoresService(makeDb(tx), supabaseAdmin, makeCache(), makeStorage());

    await expect(
      svc.update('u1', { email: 'repetido@vacker.com.ar' } as unknown as UpdateVendedor, CTX),
    ).rejects.toThrow(BadRequestException);
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('update de roles NO borra admin_plataforma (solo reemplaza roles asignables)', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi.fn().mockResolvedValue({ id: 'u1', email: 'ana@vacker.test' });
    tx.usuario.findUniqueOrThrow = vi.fn().mockResolvedValue(vendedorRow);
    const svc = new VendedoresService(makeDb(tx), makeSupabaseAdmin(), makeCache(), makeStorage());

    await svc.update('u1', { roles: ['vendedor'] } as unknown as UpdateVendedor, CTX);

    expect(tx.usuarioRol.deleteMany).toHaveBeenCalledTimes(1);
    const arg = tx.usuarioRol.deleteMany.mock.calls[0]![0] as { where: { rol: { in: string[] } } };
    // El deleteMany se acota a los roles asignables desde el formulario…
    expect(arg.where.rol.in).toEqual([...RolAsignableSchema.options]);
    // …y por lo tanto NUNCA toca admin_plataforma.
    expect(arg.where.rol.in).not.toContain('admin_plataforma');
  });
});
