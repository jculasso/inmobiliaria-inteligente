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
  return { setEmail: vi.fn() } as unknown as SupabaseAdminService & {
    setEmail: ReturnType<typeof vi.fn>;
  };
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
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
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
      usuario: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existente' }),
        findUniqueOrThrow: vi.fn(),
      },
    });
    const svc = new VendedoresService(makeDb(tx), makeSupabaseAdmin(), makeCache(), makeStorage());

    await expect(
      svc.create(
        {
          nombre: 'X',
          email: 'ana@vacker.test',
          estado: 'activo',
          roles: ['vendedor'],
        } as unknown as CreateVendedor,
        CTX,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('update: un usuario no puede ser su propio líder', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ roles: [], id: 'u1', email: 'ana@vacker.test' });
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
      .mockResolvedValue({ roles: [], id: 'u1', email: 'viejo@vacker.com', authUserId: 'auth-1' });
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
      .mockResolvedValue({ roles: [], id: 'u1', email: 'viejo@vacker.com', authUserId: null });
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
      .mockResolvedValue({ roles: [], id: 'u1', email: 'viejo@vacker.com', authUserId: 'auth-1' });
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
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ roles: [], id: 'u1', email: 'ana@vacker.test' });
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

  // Auditoría de seguridad del 6/10/2026: con el email de la cuenta de
  // plataforma cambiado, «olvidé mi clave» daba acceso a todas las inmobiliarias.
  it('la cuenta de plataforma no se edita ni se da de baja desde una inmobiliaria', async () => {
    const tx = makeTx();
    tx.usuario.findUnique = vi.fn().mockResolvedValue({
      id: 'p1',
      email: 'plataforma@x.test',
      authUserId: 'auth-p',
      roles: [{ rol: 'admin_plataforma' }],
    });
    const supabaseAdmin = makeSupabaseAdmin();
    const svc = new VendedoresService(makeDb(tx), supabaseAdmin, makeCache(), makeStorage());
    await expect(
      svc.update('p1', { email: 'yo@x.test' } as unknown as UpdateVendedor, CTX),
    ).rejects.toThrow(/plataforma/);
    await expect(svc.desactivar('p1', CTX)).rejects.toThrow(/plataforma/);
    expect(supabaseAdmin.setEmail).not.toHaveBeenCalled();
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('dirección no edita a un administrador ni se da el rol de administrador', async () => {
    const tx = makeTx();
    const direccion: TenantContext = { ...CTX, roles: ['direccion'] };
    const svc = new VendedoresService(makeDb(tx), makeSupabaseAdmin(), makeCache(), makeStorage());
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'a1', email: 'admin@x.test', roles: [{ rol: 'admin_tenant' }] });
    await expect(
      svc.update('a1', { nombre: 'Otro' } as unknown as UpdateVendedor, direccion),
    ).rejects.toThrow(/otro administrador/);
    tx.usuario.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'd1', email: 'dir@x.test', roles: [{ rol: 'direccion' }] });
    await expect(
      svc.update('d1', { roles: ['admin_tenant'] } as unknown as UpdateVendedor, direccion),
    ).rejects.toThrow(/rol de administrador/);
  });
});

describe('VendedoresService · auditoría del 6/10/2026', () => {
  const DIRECCION: TenantContext = { ...CTX, roles: ['direccion'] };
  const conAcceso = { id: 'u1', email: 'viejo@x.test', authUserId: 'auth-1', roles: [] };
  const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

  function armar(actual: unknown) {
    const tx = makeTx();
    tx.usuario.findUnique = vi.fn().mockResolvedValue(actual);
    tx.usuario.findUniqueOrThrow = vi.fn().mockResolvedValue(vendedorRow);
    tx.usuario.update = vi.fn().mockResolvedValue(vendedorRow);
    let enTx = false;
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => {
        enTx = true;
        try {
          return await fn(tx);
        } finally {
          enTx = false;
        }
      }),
    } as unknown as TenantPrismaService;
    const llamadasEnTx: string[] = [];
    const supabaseAdmin = {
      setEmail: vi.fn(async () => {
        if (enTx) llamadasEnTx.push('setEmail');
      }),
    } as unknown as SupabaseAdminService & { setEmail: ReturnType<typeof vi.fn> };
    const upload = vi.fn(async () => {
      if (enTx) llamadasEnTx.push('upload');
      return 'https://storage.test/usuarios-avatares/t1/u1.jpg';
    });
    const remove = vi.fn(async () => {
      if (enTx) llamadasEnTx.push('remove');
    });
    const storage = makeStorage({ upload, remove });
    const cache = makeCache();
    const svc = new VendedoresService(db, supabaseAdmin, cache, storage);
    return { svc, tx, supabaseAdmin, upload, remove, cache, llamadasEnTx };
  }

  // Cambiar el email de alguien que ya entra es cambiar adónde llega «olvidé
  // mi clave»: quien lo cambie se puede quedar con la cuenta.
  it('dirección NO cambia el email de alguien que ya tiene acceso', async () => {
    const { svc, supabaseAdmin, tx } = armar(conAcceso);
    await expect(
      svc.update('u1', { email: 'mio@x.test' } as unknown as UpdateVendedor, DIRECCION),
    ).rejects.toThrow(/solo lo cambia el administrador/);
    expect(supabaseAdmin.setEmail).not.toHaveBeenCalled();
    expect(tx.usuario.update).not.toHaveBeenCalled();
  });

  it('el administrador sí puede cambiarlo', async () => {
    const { svc, supabaseAdmin } = armar(conAcceso);
    await svc.update('u1', { email: 'nuevo@x.test' } as unknown as UpdateVendedor, CTX);
    expect(supabaseAdmin.setEmail).toHaveBeenCalledWith('auth-1', 'nuevo@x.test');
  });

  it('dirección sí cambia el email de alguien que todavía no tiene acceso', async () => {
    const { svc, tx } = armar({ ...conAcceso, authUserId: null });
    await svc.update('u1', { email: 'nuevo@x.test' } as unknown as UpdateVendedor, DIRECCION);
    expect(tx.usuario.update).toHaveBeenCalled();
  });

  it('Supabase Auth se llama FUERA de la transacción', async () => {
    const { svc, llamadasEnTx } = armar(conAcceso);
    await svc.update('u1', { email: 'nuevo@x.test' } as unknown as UpdateVendedor, CTX);
    expect(llamadasEnTx).toEqual([]);
  });

  it('si la base falla después de cambiar Auth, el email de Auth vuelve al anterior', async () => {
    const { svc, tx, supabaseAdmin } = armar(conAcceso);
    tx.usuario.update = vi.fn().mockRejectedValue(new Error('base caída'));
    await expect(
      svc.update('u1', { email: 'nuevo@x.test' } as unknown as UpdateVendedor, CTX),
    ).rejects.toThrow('base caída');
    expect(supabaseAdmin.setEmail).toHaveBeenNthCalledWith(1, 'auth-1', 'nuevo@x.test');
    expect(supabaseAdmin.setEmail).toHaveBeenNthCalledWith(2, 'auth-1', 'viejo@x.test');
  });

  it('dirección no crea un usuario con rol de administrador', async () => {
    const { svc, tx } = armar(null);
    await expect(
      svc.create(
        {
          nombre: 'X',
          email: 'x@x.test',
          estado: 'activo',
          roles: ['admin_tenant'],
        } as unknown as CreateVendedor,
        DIRECCION,
      ),
    ).rejects.toThrow(/rol de administrador/);
    expect(tx.usuario.create).not.toHaveBeenCalled();
  });

  it('objetivo y foto también respetan a quién se puede administrar', async () => {
    const admin = { id: 'a1', fotoUrl: null, roles: [{ rol: 'admin_tenant' }] };
    const { svc, tx, upload } = armar(admin);
    await expect(
      svc.setObjetivo('a1', { anio: 2026, objComision: 1, objVolumen: 1, objPuntas: 1 }, DIRECCION),
    ).rejects.toThrow(/otro administrador/);
    await expect(
      svc.subirFoto(
        'a1',
        { buffer: JPG, mimetype: 'image/jpeg', originalname: 'a.jpg', size: 8 },
        DIRECCION,
      ),
    ).rejects.toThrow(/otro administrador/);
    await expect(svc.eliminarFoto('a1', DIRECCION)).rejects.toThrow(/otro administrador/);
    expect(tx.objetivo.upsert).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('la cuenta de plataforma tampoco: ni objetivo ni foto', async () => {
    const plataforma = { id: 'p1', fotoUrl: null, roles: [{ rol: 'admin_plataforma' }] };
    const { svc } = armar(plataforma);
    await expect(
      svc.setObjetivo('p1', { anio: 2026, objComision: 1, objVolumen: 1, objPuntas: 1 }, CTX),
    ).rejects.toThrow(/plataforma/);
    await expect(svc.eliminarFoto('p1', CTX)).rejects.toThrow(/plataforma/);
  });

  it('la foto se sube y se borra fuera de la transacción', async () => {
    const vendedor = {
      id: 'u1',
      fotoUrl: 'https://s.test/usuarios-avatares/t1/u1.jpg',
      roles: [{ rol: 'vendedor' }],
    };
    const { svc, llamadasEnTx, upload, remove } = armar(vendedor);
    await svc.subirFoto(
      'u1',
      { buffer: JPG, mimetype: 'image/jpeg', originalname: 'a.jpg', size: 8 },
      CTX,
    );
    await svc.eliminarFoto('u1', CTX);
    expect(upload).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('usuarios-avatares', 't1/u1.jpg');
    expect(llamadasEnTx).toEqual([]);
  });

  it('dar de baja o editar invalida el cache del principal en el momento', async () => {
    const { svc, cache } = armar({ id: 'u1', email: 'a@x.test', fotoUrl: null, roles: [] });
    await svc.desactivar('u1', CTX);
    expect(cache.invalidarUsuario).toHaveBeenCalledWith('u1');
    (cache.invalidarUsuario as ReturnType<typeof vi.fn>).mockClear();
    await svc.update('u1', { roles: ['team_leader'] } as unknown as UpdateVendedor, CTX);
    expect(cache.invalidarUsuario).toHaveBeenCalledWith('u1');
  });
});
