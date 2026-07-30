import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { encriptarSecreto } from '../../common/cripto-secreto';
import { PublicacionService } from './publicacion.service';

const CTX: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['admin_tenant'] };
/** 32 bytes en base64, como la variable real. */
const ENC_KEY = Buffer.alloc(32, 7).toString('base64');
const SECRETO = '703c39612344aa2e5f8ddfda2b9ad0e77db318bc';

function makeTx(over: Record<string, unknown> = {}) {
  return {
    integracionCredencial: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      ...(over.integracionCredencial ?? {}),
    },
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

/** Sin valor por defecto a propósito: pasar `undefined` a un parámetro con
 *  default lo reemplaza por el default, y el test terminaría probando otra cosa. */
const makeConfig = (key: string | undefined) =>
  ({ get: vi.fn().mockReturnValue(key) }) as unknown as ConfigService;

describe('PublicacionService — la credencial no sale nunca', () => {
  it('el estado dice si está configurada y los últimos 4, no el secreto', async () => {
    const tx = makeTx({
      integracionCredencial: {
        findFirst: vi.fn().mockResolvedValue({ ultimos4: '18bc', updatedAt: new Date('2026-07-30') }),
      },
    });
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));

    const estado = await svc.estado();

    expect(estado).toEqual({
      configurada: true,
      ultimos4: '18bc',
      actualizadoEl: '2026-07-30T00:00:00.000Z',
    });
    // La garantía que importa: el objeto no tiene por dónde filtrar el secreto.
    expect(JSON.stringify(estado)).not.toContain(SECRETO);
    expect(Object.keys(estado)).not.toContain('secretoEnc');
  });

  it('guarda el secreto CIFRADO, nunca en claro', async () => {
    const upsert = vi.fn().mockResolvedValue({ ultimos4: '18bc', updatedAt: new Date() });
    const tx = makeTx({ integracionCredencial: { upsert } });
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));

    await svc.guardar(SECRETO, CTX);

    const data = upsert.mock.calls[0]![0].create;
    expect(data.secretoEnc).not.toBe(SECRETO);
    expect(data.secretoEnc).not.toContain(SECRETO);
    // Formato "iv.tag.ciphertext": tres partes en base64.
    expect(data.secretoEnc.split('.')).toHaveLength(3);
    expect(data.ultimos4).toBe('18bc');
    // Se registra quién la cargó, para poder preguntarle.
    expect(data.actualizadoPor).toBe('u1');
  });

  it('sin la clave de cifrado del servidor, falla con un mensaje que dice qué falta', async () => {
    // Antes de esto el error era un 500 sin pista y el implementador no tenía
    // forma de saber que faltaba una variable de entorno.
    const svc = new PublicacionService(makeDb(makeTx()), makeConfig(undefined));
    await expect(svc.guardar(SECRETO, CTX)).rejects.toThrow(BadRequestException);
    await expect(svc.guardar(SECRETO, CTX)).rejects.toThrow(/INTEGRACIONES_ENC_KEY/);
  });
});

describe('PublicacionService — probar conexión', () => {
  it('sin credencial cargada lo dice, en vez de tirar un error', async () => {
    const svc = new PublicacionService(makeDb(makeTx()), makeConfig(ENC_KEY));
    const r = await svc.probarConexion();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no hay una clave/i);
  });

  it('si la clave de cifrado cambió, explica que hay que volver a cargarla', async () => {
    // Es la situación real: alguien rota INTEGRACIONES_ENC_KEY y lo guardado
    // queda ilegible. No se puede recuperar, así que el mensaje tiene que
    // decir qué hacer y no solo que falló.
    const guardadoConOtraClave = encriptarSecreto(SECRETO, Buffer.alloc(32, 1).toString('base64'));
    const tx = makeTx({
      integracionCredencial: {
        findFirst: vi.fn().mockResolvedValue({ secretoEnc: guardadoConOtraClave }),
      },
    });
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));

    const r = await svc.probarConexion();

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/volvé a cargarla/i);
  });

  it('devuelve cuántas propiedades ve la cuenta cuando Tokko responde', async () => {
    // El número es lo que le confirma al usuario que cargó la clave de SU
    // inmobiliaria y no la de otra.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ meta: { total_count: 387 }, objects: [] }), { status: 200 }),
    );
    const tx = makeTx({
      integracionCredencial: {
        findFirst: vi.fn().mockResolvedValue({ secretoEnc: encriptarSecreto(SECRETO, ENC_KEY) }),
      },
    });
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));

    const r = await svc.probarConexion();

    expect(r).toEqual({ ok: true, propiedades: 387, error: null });
    // Y que la clave viaje como Tokko la espera, sin filtrarse en el path.
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('key=' + SECRETO);
    fetchSpy.mockRestore();
  });

  it('si Tokko rechaza la clave, lo dice con esas palabras', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('no', { status: 401 }));
    const tx = makeTx({
      integracionCredencial: {
        findFirst: vi.fn().mockResolvedValue({ secretoEnc: encriptarSecreto(SECRETO, ENC_KEY) }),
      },
    });
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));

    const r = await svc.probarConexion();

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/rechazó la clave/i);
    fetchSpy.mockRestore();
  });
});

describe('PublicacionService — vaciar el espejo', () => {
  it('borra solo la copia local y dice cuántas', async () => {
    // Es seguro por naturaleza: el original vive en Tokko. Por eso no hay
    // respaldo ni confirmación extra del lado del servidor — muy distinto de
    // borrar una tasación, donde se pierde trabajo hecho.
    const deleteMany = vi.fn().mockResolvedValue({ count: 10 });
    const tx = { propiedad: { deleteMany } };
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));

    expect(await svc.vaciarPropiedades()).toEqual({ borradas: 10 });
    // Sin `where`: dentro de withTenant, RLS ya acota a la inmobiliaria.
    expect(deleteMany).toHaveBeenCalledWith({});
  });
});
