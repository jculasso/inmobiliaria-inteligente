import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PropiedadAlquilerInputSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { PropiedadesAlquilerService } from './propiedades.service';
import { mocksDeHistorial } from './historial.testing';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };

function makeDb(tx: unknown): TenantPrismaService {
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
}

describe('PropiedadesAlquilerService', () => {
  it('editar una propiedad que no existe (o de otra inmobiliaria) es 404', async () => {
    const tx = { alqPropiedad: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } };
    const dto = PropiedadAlquilerInputSchema.parse({ direccion: 'Maipú 1234' });
    await expect(
      new PropiedadesAlquilerService(makeDb(tx)).actualizar(CTX, 'x', dto),
    ).rejects.toThrow(NotFoundException);
    expect(tx.alqPropiedad.update).not.toHaveBeenCalled();
  });

  it('lista por dirección y unidad, dentro del tenant', async () => {
    const tx = { alqPropiedad: { findMany: vi.fn().mockResolvedValue([]) } };
    const db = makeDb(tx);
    await new PropiedadesAlquilerService(db).listar();
    expect(db.withTenant).toHaveBeenCalledTimes(1);
    expect(tx.alqPropiedad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ direccion: 'asc' }, { unidad: 'asc' }] }),
    );
  });

  it('una propiedad con contratos no se borra', async () => {
    const tx = {
      ...mocksDeHistorial(),
      alqPropiedad: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ direccion: 'Maipú 1234', unidad: '2° A', _count: { contratos: 1 } }),
        delete: vi.fn(),
      },
    };
    await expect(new PropiedadesAlquilerService(makeDb(tx)).borrar(CTX, 'x')).rejects.toThrow(
      'Maipú 1234 2° A no se puede borrar: tiene 1 contrato.',
    );
    expect(tx.alqPropiedad.delete).not.toHaveBeenCalled();
  });

  it('una propiedad sin contratos se borra, y queda en el historial', async () => {
    const tx = {
      ...mocksDeHistorial(),
      alqPropiedad: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ direccion: 'Maipú 1234', unidad: null, _count: { contratos: 0 } }),
        delete: vi.fn(),
      },
    };
    await new PropiedadesAlquilerService(makeDb(tx)).borrar(CTX, 'x');
    expect(tx.alqPropiedad.delete).toHaveBeenCalled();
    expect(tx.alqEvento.createMany).toHaveBeenCalledTimes(1);
  });
});
