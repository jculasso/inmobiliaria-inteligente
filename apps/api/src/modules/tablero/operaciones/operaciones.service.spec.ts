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
