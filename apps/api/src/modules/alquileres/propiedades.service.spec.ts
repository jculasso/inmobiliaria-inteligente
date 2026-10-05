import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PropiedadAlquilerInputSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { PropiedadesAlquilerService } from './propiedades.service';

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

describe('PropiedadesAlquilerService', () => {
  it('editar una propiedad que no existe (o de otra inmobiliaria) es 404', async () => {
    const tx = { alqPropiedad: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } };
    const dto = PropiedadAlquilerInputSchema.parse({ direccion: 'Maipú 1234' });
    await expect(new PropiedadesAlquilerService(makeDb(tx)).actualizar('x', dto)).rejects.toThrow(NotFoundException);
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
});
