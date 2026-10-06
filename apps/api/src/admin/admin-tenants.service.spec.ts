import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MODULOS_DEFAULT } from '@vacker/types';
import type { SupabaseStorageService } from '../common/supabase-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PrincipalCacheService } from '../auth/principal-cache.service';
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

/** ConfigService mínimo: solo se usa para la clave de cifrado de credenciales. */
function makeConfig() {
  return { get: vi.fn().mockReturnValue(Buffer.alloc(32, 3).toString('base64')) } as never;
}

function makeCache() {
  return { invalidarTenant: vi.fn() } as unknown as PrincipalCacheService & {
    invalidarTenant: ReturnType<typeof vi.fn>;
  };
}

/** Los primeros bytes de un PNG real: lo que el servidor mira para aceptar el logo. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('AdminTenantsService', () => {
  it('list devuelve todas las inmobiliarias ordenadas por nombre', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 't1', nombre: 'Vacker' }]);
    const db = makeDb({ findMany });
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    const result = await service.list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { nombre: 'asc' } });
    expect(result).toEqual([{ id: 't1', nombre: 'Vacker' }]);
  });

  it('create rechaza un slug duplicado', async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue({ id: 't1' }) });
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    await expect(
      service.create({ nombre: 'Otra', slug: 'vacker', plan: 'basico' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create da de alta la inmobiliaria con slug libre', async () => {
    const create = vi.fn().mockResolvedValue({ id: 't2', nombre: 'Otra', slug: 'otra' });
    const db = makeDb({ create });
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    const result = await service.create({ nombre: 'Otra', slug: 'otra', plan: 'basico' });

    expect(create).toHaveBeenCalledWith({
      data: { nombre: 'Otra', slug: 'otra', plan: 'basico', modulos: MODULOS_DEFAULT, config: {} },
    });
    expect(result.slug).toBe('otra');
  });

  it('update lanza 404 si la inmobiliaria no existe', async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue(null) });
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    await expect(service.update('nope', { estado: 'suspendido' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update aplica los cambios', async () => {
    const update = vi.fn().mockResolvedValue({ id: 't1', estado: 'suspendido' });
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue({ id: 't1' }), update });
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

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
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    await expect(service.update('t1', { slug: 'nueva' })).rejects.toThrow(BadRequestException);
  });

  it('update mergea config en vez de reemplazarlo', async () => {
    const update = vi.fn().mockResolvedValue({ id: 't1' });
    const db = makeDb({
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 't1', slug: 'vacker', config: { logoUrl: 'https://x/logo.png' } }),
      update,
    });
    const service = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    await service.update('t1', { config: { colorPrimario: '#123456' } });

    expect(update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { config: { logoUrl: 'https://x/logo.png', colorPrimario: '#123456' } },
    });
  });
});

/**
 * Credencial de Tokko. Vivía en el módulo de Publicación y se movió acá: cargar
 * una API key es configuración de alta, no una tarea diaria, y en la pantalla
 * donde se publica cualquiera con rol `publicador` podía reemplazarla.
 */
describe('AdminTenantsService — credencial de Tokko', () => {
  const ENC = Buffer.alloc(32, 3).toString('base64');
  const SECRETO = '703c39612344aa2e5f8ddfda2b9ad0e77db318bc';
  const TENANT = 't1';

  function dbCon(credencial: Record<string, unknown> = {}) {
    return {
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: TENANT }) },
      integracionCredencial: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ ultimos4: '18bc', updatedAt: new Date('2026-07-30') }),
        deleteMany: vi.fn(),
        ...credencial,
      },
    } as unknown as PrismaService;
  }

  it('guarda el secreto CIFRADO y devuelve solo los últimos 4', async () => {
    const db = dbCon();
    const svc = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    const r = await svc.guardarCredencial(TENANT, SECRETO, 'admin-1');

    const upsert = (
      db as unknown as { integracionCredencial: { upsert: ReturnType<typeof vi.fn> } }
    ).integracionCredencial.upsert;
    const data = upsert.mock.calls[0]![0].create;
    expect(data.secretoEnc).not.toContain(SECRETO);
    expect(data.secretoEnc.split('.')).toHaveLength(3); // iv.tag.ciphertext
    expect(data.actualizadoPor).toBe('admin-1');
    // Lo que sale hacia el cliente no tiene por dónde filtrar la clave.
    expect(JSON.stringify(r)).not.toContain(SECRETO);
  });

  it('sin la clave de cifrado del servidor, dice qué variable falta', async () => {
    const sinClave = { get: vi.fn().mockReturnValue(undefined) } as never;
    const svc = new AdminTenantsService(dbCon(), storage, sinClave, makeCache());
    await expect(svc.guardarCredencial(TENANT, SECRETO, 'admin-1')).rejects.toThrow(
      /INTEGRACIONES_ENC_KEY/,
    );
  });

  it('probar sin credencial cargada lo dice, en vez de fallar', async () => {
    const svc = new AdminTenantsService(dbCon(), storage, makeConfig(), makeCache());
    const r = await svc.probarCredencial(TENANT);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no hay una clave/i);
  });

  it('probar devuelve cuántas propiedades ve la cuenta', async () => {
    // El número es lo que confirma que se cargó la clave de ESA inmobiliaria.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ meta: { total_count: 387 }, objects: [] }), { status: 200 }),
      );
    const { encriptarSecreto } = await import('../common/cripto-secreto');
    const db = dbCon({
      findFirst: vi.fn().mockResolvedValue({ secretoEnc: encriptarSecreto(SECRETO, ENC) }),
    });
    const svc = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    expect(await svc.probarCredencial(TENANT)).toEqual({ ok: true, propiedades: 387, error: null });
    fetchSpy.mockRestore();
  });

  it('si Tokko rechaza la clave, lo dice con esas palabras', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('no', { status: 401 }));
    const { encriptarSecreto } = await import('../common/cripto-secreto');
    const db = dbCon({
      findFirst: vi.fn().mockResolvedValue({ secretoEnc: encriptarSecreto(SECRETO, ENC) }),
    });
    const svc = new AdminTenantsService(db, storage, makeConfig(), makeCache());

    const r = await svc.probarCredencial(TENANT);

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/rechazó la clave/i);
    fetchSpy.mockRestore();
  });
});

describe('AdminTenantsService · logo', () => {
  function armar() {
    const upload = vi.fn().mockResolvedValue('https://storage.test/tenants-logos/t1/logo.png');
    const db = makeDb({
      findUnique: vi.fn().mockResolvedValue({ id: 't1', slug: 's', config: {} }),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
    });
    const svc = new AdminTenantsService(
      db,
      { upload } as unknown as SupabaseStorageService,
      makeConfig(),
      makeCache(),
    );
    return { svc, upload };
  }

  // El bucket es público: un SVG (o un HTML) declarado como imagen se serviría
  // desde nuestro Storage. Se mira el contenido, no lo que dice el navegador.
  it('rechaza un SVG aunque el navegador lo declare como imagen', async () => {
    const { svc, upload } = armar();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>');
    await expect(
      svc.subirLogo('t1', {
        buffer: svg,
        mimetype: 'image/svg+xml',
        originalname: 'logo.svg',
        size: svg.length,
      }),
    ).rejects.toThrow(/PNG, JPG o WebP/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('rechaza contenido que no es imagen aunque se llame .png', async () => {
    const { svc } = armar();
    const html = Buffer.from('<html><body>hola</body></html>');
    await expect(
      svc.subirLogo('t1', {
        buffer: html,
        mimetype: 'image/png',
        originalname: 'logo.png',
        size: html.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guarda con la extensión y el tipo VERIFICADOS, no con los declarados', async () => {
    const { svc, upload } = armar();
    await svc.subirLogo('t1', {
      buffer: PNG,
      mimetype: 'image/gif',
      originalname: 'logo.gif',
      size: PNG.length,
    });
    expect(upload).toHaveBeenCalledWith('tenants-logos', 't1/logo.png', PNG, 'image/png');
  });
});

describe('AdminTenantsService · cache de sesiones', () => {
  // Suspender una inmobiliaria tiene que cortar a sus usuarios en la próxima
  // request, no 30 segundos después.
  it('update invalida el cache del principal de toda la inmobiliaria', async () => {
    const cache = makeCache();
    const db = makeDb({
      findUnique: vi.fn().mockResolvedValue({ id: 't1', slug: 's', config: {} }),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
    });
    const svc = new AdminTenantsService(db, storage, makeConfig(), cache);
    await svc.update('t1', { estado: 'suspendido' });
    expect(cache.invalidarTenant).toHaveBeenCalledWith('t1');
  });
});
