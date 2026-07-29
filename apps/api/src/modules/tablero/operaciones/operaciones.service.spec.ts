import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CreateOperacion, UpdateOperacion } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import type { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { OperacionesService } from './operaciones.service';

const CTX_DIRECCION: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['direccion'] };
const CTX_VENDEDOR: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['vendedor'] };

/** tx mockeado; cada test sobrescribe los métodos que le importan. */
function makeTx(over: Record<string, unknown> = {}) {
  return {
    operacion: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    operacionPunta: { deleteMany: vi.fn() },
    usuario: { findMany: vi.fn().mockResolvedValue([]) },
    ...over,
  };
}

/** withTenant corre el callback con el tx mockeado (sin transacción real). */
function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

const ventaDtoBase = {
  codigo: 'V1',
  tipo: 'venta',
  direccion: 'Calle 1',
  moneda: 'USD',
  estado: 'escriturada',
  fechaReserva: null,
  fechaFirma: '2026-01-15',
  precio: 100000,
  puntas: [{ lado: 'vendedora', usuarioId: 'u1', comision: 5000 }],
} as unknown as CreateOperacion;

describe('OperacionesService — scope', () => {
  it('getOne: un vendedor NO ve una operación en la que no tiene puntas (assertEnScope → 404)', async () => {
    const tx = makeTx();
    tx.operacion.findUnique = vi.fn().mockResolvedValue({
      id: 'o1',
      tenantId: 't1',
      puntas: [{ usuarioId: 'otro' }],
    });
    const svc = new OperacionesService(makeDb(tx));

    await expect(svc.getOne('o1', CTX_VENDEDOR)).rejects.toThrow(NotFoundException);
  });

  it('getOne: un vendedor SÍ ve una operación en la que tiene una punta', async () => {
    const tx = makeTx();
    tx.operacion.findUnique = vi.fn().mockResolvedValue({
      id: 'o1',
      codigo: 'V1',
      tipo: 'venta',
      direccion: 'Calle 1',
      precio: null,
      valorMensual: null,
      moneda: 'USD',
      cantPuntas: 1,
      comTotal: null,
      estado: 'escriturada',
      fechaReserva: null,
      fechaFirma: null,
      anio: 2026,
      mes: 1,
      obs: null,
      puntas: [{ id: 'p1', lado: 'vendedora', usuarioId: 'u1', comision: null, usuario: { nombre: 'Yo' } }],
    });
    const svc = new OperacionesService(makeDb(tx));

    const dto = await svc.getOne('o1', CTX_VENDEDOR);
    expect(dto.id).toBe('o1');
    expect(dto.puntas[0]?.nombre).toBe('Yo');
  });

  it('getOne: 404 si la operación no existe', async () => {
    const tx = makeTx();
    tx.operacion.findUnique = vi.fn().mockResolvedValue(null);
    const svc = new OperacionesService(makeDb(tx));

    await expect(svc.getOne('o1', CTX_DIRECCION)).rejects.toThrow(NotFoundException);
  });
});

describe('OperacionesService — coherencia y unicidad', () => {
  it('update: rechaza puntas en un alquiler', async () => {
    const tx = makeTx();
    tx.operacion.findUnique = vi.fn().mockResolvedValue({ id: 'o1', tenantId: 't1', tipo: 'alquiler', puntas: [] });
    const svc = new OperacionesService(makeDb(tx));

    await expect(
      svc.update('o1', { puntas: [] } as unknown as UpdateOperacion, CTX_DIRECCION),
    ).rejects.toThrow(BadRequestException);
  });

  it('update: rechaza un estado de alquiler en una venta', async () => {
    const tx = makeTx();
    tx.operacion.findUnique = vi.fn().mockResolvedValue({ id: 'o1', tenantId: 't1', tipo: 'venta', puntas: [] });
    const svc = new OperacionesService(makeDb(tx));

    await expect(
      svc.update('o1', { estado: 'firmado' } as unknown as UpdateOperacion, CTX_DIRECCION),
    ).rejects.toThrow(BadRequestException);
  });

  it('create: rechaza un código ya usado', async () => {
    const tx = makeTx();
    tx.operacion.findFirst = vi.fn().mockResolvedValue({ id: 'dup' });
    const svc = new OperacionesService(makeDb(tx));

    await expect(svc.create(ventaDtoBase, CTX_DIRECCION)).rejects.toThrow(BadRequestException);
  });

  it('create: rechaza una punta con un usuario inexistente en el tenant', async () => {
    const tx = makeTx();
    tx.operacion.findFirst = vi.fn().mockResolvedValue(null); // código libre
    tx.usuario.findMany = vi.fn().mockResolvedValue([]); // 0 encontrados, 1 esperado
    const svc = new OperacionesService(makeDb(tx));

    await expect(svc.create(ventaDtoBase, CTX_DIRECCION)).rejects.toThrow(BadRequestException);
  });
});

describe('OperacionesService — orden del listado', () => {
  /** Devuelve el `orderBy` con el que el servicio consultó la base. */
  async function orderByDe(filtro: Record<string, unknown>) {
    const tx = makeTx();
    const svc = new OperacionesService(makeDb(tx));
    await svc.list(filtro as never, CTX_DIRECCION);
    const findMany = tx.operacion.findMany as ReturnType<typeof vi.fn>;
    const orderBy = findMany.mock.calls[0]?.[0]?.orderBy as
      | { fechaFirma?: { sort: string; nulls: string }; codigoNum?: unknown; codigo?: unknown }[]
      | undefined;
    if (!orderBy) throw new Error('El servicio no llamó a findMany con un orderBy.');
    return orderBy;
  }

  it('por defecto, la operación más nueva arriba', async () => {
    expect(await orderByDe({})).toEqual([
      { codigoNum: { sort: 'desc', nulls: 'last' } },
      { codigo: 'desc' },
    ]);
  });

  /**
   * El punto de todo el cambio. El código es texto ("OP-1001", "OP-999") y
   * ordenar texto NO da orden numérico: "OP-1001" quedaría ANTES que "OP-999"
   * porque compara carácter por carácter. Por eso se ordena por la columna
   * generada `codigoNum` y nunca por `codigo`.
   */
  it('ordena por el NÚMERO del código, no por el texto', async () => {
    const orderBy = await orderByDe({ orden: 'codigo', dir: 'desc' });
    expect(orderBy[0]).toHaveProperty('codigoNum');
    expect(orderBy[0]).not.toHaveProperty('codigo');
  });

  it('ordena por fecha de firma en los dos sentidos', async () => {
    expect((await orderByDe({ orden: 'fechaFirma', dir: 'asc' }))[0]).toEqual({
      fechaFirma: { sort: 'asc', nulls: 'last' },
    });
    expect((await orderByDe({ orden: 'fechaFirma', dir: 'desc' }))[0]).toEqual({
      fechaFirma: { sort: 'desc', nulls: 'last' },
    });
  });

  it('las filas sin dato quedan al final en los DOS sentidos', async () => {
    // Ascendente es el caso que se olvida: por defecto Postgres pondría los
    // nulos primero y la pantalla abriría con un bloque de guiones.
    for (const dir of ['asc', 'desc'] as const) {
      const orderBy = await orderByDe({ orden: 'fechaFirma', dir });
      expect(orderBy[0]?.fechaFirma?.nulls).toBe('last');
    }
  });

  it('desempata siempre, para que la lista no se mueva sola entre recargas', async () => {
    for (const orden of ['codigo', 'fechaFirma'] as const) {
      expect(await orderByDe({ orden })).toHaveLength(2);
    }
  });
});

/**
 * Una venta con dos puntas donde solo una es tuya: la otra no es asunto tuyo.
 *
 * Los KPIs ya lo respetaban (`agregar` filtra por alcance) pero el listado no,
 * así que el tablero y la tabla decían cosas distintas sobre la misma venta.
 */
describe('OperacionesService — puntas fuera del alcance', () => {
  const CTX_VENDEDOR_A: TenantContext = { tenantId: 't1', userId: 'vA', roles: ['vendedor'] };

  /** Venta compartida: una punta de vA (5.000) y otra de un ajeno (3.000). */
  const compartida = {
    id: 'op1',
    codigo: 'OP-1',
    tipo: 'venta',
    direccion: 'Calle 1',
    precio: 100000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 2,
    comTotal: 8000,
    estado: 'escriturada',
    fechaReserva: null,
    fechaFirma: new Date('2026-05-10'),
    anio: 2026,
    mes: 5,
    obs: null,
    puntas: [
      { id: 'p1', lado: 'vendedora', usuarioId: 'vA', comision: 5000, usuario: { id: 'vA', nombre: 'Ana' } },
      { id: 'p2', lado: 'compradora', usuarioId: 'vB', comision: 3000, usuario: { id: 'vB', nombre: 'Beto' } },
    ],
  };

  async function listarComo(ctx: TenantContext, row: unknown = compartida) {
    const tx = makeTx();
    tx.operacion.findMany = vi.fn().mockResolvedValue([row]);
    const svc = new OperacionesService(makeDb(tx));
    return (await svc.list({} as never, ctx))[0]!;
  }

  it('no devuelve el nombre del vendedor ajeno', async () => {
    const dto = await listarComo(CTX_VENDEDOR_A);
    const nombres = dto.puntas.map((p) => p.nombre);
    expect(nombres).toEqual(['Ana']);
    expect(nombres).not.toContain('Beto');
  });

  it('la comisión que se muestra es solo la propia', async () => {
    // La operación tiene 8.000 de comisión total; a Ana le corresponden 5.000.
    // Si mostrara 8.000, la tabla contradiría a su propio tablero.
    const dto = await listarComo(CTX_VENDEDOR_A);
    expect(dto.comTotal).toBe(5000);
  });

  it('la operación SIGUE apareciendo: tiene una punta suya', async () => {
    const dto = await listarComo(CTX_VENDEDOR_A);
    expect(dto.codigo).toBe('OP-1');
  });

  it('conserva que la venta tuvo dos puntas', async () => {
    // Cuántas puntas tuvo la operación no es confidencial —el nombre sí—, y
    // verla como "2 puntas, una tuya" explica sola por qué la comisión es esa.
    const dto = await listarComo(CTX_VENDEDOR_A);
    expect(dto.cantPuntas).toBe(2);
  });

  it('a dirección con "Ver todo" no se le oculta nada', async () => {
    const tx = makeTx();
    tx.operacion.findMany = vi.fn().mockResolvedValue([compartida]);
    const svc = new OperacionesService(makeDb(tx));
    const dto = (await svc.list({ verTodo: true } as never, CTX_DIRECCION))[0]!;
    expect(dto.puntas.map((p) => p.nombre)).toEqual(['Ana', 'Beto']);
    expect(dto.comTotal).toBe(8000);
  });

  /**
   * El caso real que se escapó: Ezequiel es vendedor Y dirección. Cuando
   * destilda "Ver todo" está pidiendo SUS números, así que ver la comisión
   * completa de una venta compartida hacía que la tabla contradijera a su
   * propio tablero.
   *
   * Por eso se oculta con el alcance de la VISTA y no con el del rol: lo que
   * se muestra tiene que sumar lo mismo que lo que se calculó.
   */
  it('dirección SIN "Ver todo" ve solo su punta y su comisión', async () => {
    const ctxCeo: TenantContext = { tenantId: 't1', userId: 'vA', roles: ['vendedor', 'direccion'] };
    const tx = makeTx();
    tx.operacion.findMany = vi.fn().mockResolvedValue([compartida]);
    const svc = new OperacionesService(makeDb(tx));

    const dto = (await svc.list({} as never, ctxCeo))[0]!;

    expect(dto.puntas.map((p) => p.nombre)).toEqual(['Ana']);
    expect(dto.comTotal).toBe(5000);
  });

  it('y con "Ver todo" el mismo usuario ve la venta completa', async () => {
    const ctxCeo: TenantContext = { tenantId: 't1', userId: 'vA', roles: ['vendedor', 'direccion'] };
    const tx = makeTx();
    tx.operacion.findMany = vi.fn().mockResolvedValue([compartida]);
    const svc = new OperacionesService(makeDb(tx));

    const dto = (await svc.list({ verTodo: true } as never, ctxCeo))[0]!;

    expect(dto.puntas.map((p) => p.nombre)).toEqual(['Ana', 'Beto']);
    expect(dto.comTotal).toBe(8000);
  });

  it('un alquiler no pierde su comisión (no tiene puntas que ocultar)', async () => {
    // Recalcular comTotal desde las puntas dejaría todos los alquileres en 0.
    const alquiler = { ...compartida, tipo: 'alquiler', cantPuntas: 0, comTotal: 1200, puntas: [] };
    const dto = await listarComo(CTX_VENDEDOR_A, alquiler);
    expect(dto.comTotal).toBe(1200);
  });
});
