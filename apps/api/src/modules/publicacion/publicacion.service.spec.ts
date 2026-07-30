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

describe('PublicacionService — importar no escala con la cantidad', () => {
  /**
   * La primera versión hacía findFirst + create/update por propiedad: 50
   * consultas para 25. Con la base en otro continente eso se pasó del timeout
   * de la transacción y la traída se cancelaba.
   *
   * Este test fija que la cantidad de consultas NO dependa de cuántas
   * propiedades vengan, que es lo único que evita que vuelva a pasar al traer
   * las 387.
   */
  function tokkoProp(id: number) {
    return {
      id,
      reference_code: `REF-${id}`,
      publication_title: 'Depto',
      public_url: null,
      created_at: '2026-07-01T00:00:00Z',
      status: 2,
      address: 'Calle 1',
      type: { id: 1, name: 'Departamento' },
      location: { id: 9, short_location: 'Rosario' },
      operations: [{ operation_type: 'Venta', prices: [{ currency: 'USD', price: 100 }] }],
      photos: [{ image: 'https://x/1.jpg', is_front_cover: true }],
      producer: { id: 5, name: 'Ana', email: 'ana@vacker.test' },
    };
  }

  async function importarN(n: number) {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      // Primera llamada: el total. Segunda: la página de propiedades.
      const esConteo = String(url).includes('limit=1&');
      const objects = esConteo ? [] : Array.from({ length: n }, (_, i) => tokkoProp(1000 + i));
      return new Response(JSON.stringify({ meta: { total_count: n }, objects }), { status: 200 });
    });

    const findMany = vi.fn().mockResolvedValue([]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const createMany = vi.fn().mockResolvedValue({ count: n });
    const tx = {
      integracionCredencial: {
        findFirst: vi.fn().mockResolvedValue({ secretoEnc: encriptarSecreto(SECRETO, ENC_KEY) }),
      },
      usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'u1', email: 'ana@vacker.test' }]) },
      propiedad: { findMany, deleteMany, createMany },
    };
    const svc = new PublicacionService(makeDb(tx), makeConfig(ENC_KEY));
    const r = await svc.importar(n, CTX);
    fetchSpy.mockRestore();
    return { r, findMany, deleteMany, createMany };
  }

  it('con 25 propiedades hace las mismas consultas que con 5', async () => {
    const pocas = await importarN(5);
    const muchas = await importarN(25);

    for (const c of [pocas, muchas]) {
      expect(c.findMany).toHaveBeenCalledTimes(1);
      expect(c.deleteMany).toHaveBeenCalledTimes(1);
      expect(c.createMany).toHaveBeenCalledTimes(1);
    }
    expect(muchas.r.leidas).toBe(25);
    expect(muchas.r.creadas).toBe(25);
  });

  it('vincula el vendedor por email y cuenta los que no matchean', async () => {
    const { r, createMany } = await importarN(3);
    expect(r.sinAgente).toBe(0);
    expect(createMany.mock.calls[0]![0].data[0].agenteId).toBe('u1');
  });
});
