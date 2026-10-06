import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { AlquileresService } from './alquileres.service';

function makeDb(tx: unknown): TenantPrismaService {
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
}

describe('AlquileresService.resumen', () => {
  it('cuenta contratos, vigentes, personas y propiedades dentro del tenant', async () => {
    const count = vi.fn((args?: { where?: { estado?: string } }) =>
      Promise.resolve(args?.where?.estado ? 3 : 5),
    );
    const tx = {
      alqContrato: { count },
      alqPersona: { count: vi.fn().mockResolvedValue(9) },
      alqPropiedad: { count: vi.fn().mockResolvedValue(4) },
    };
    const db = makeDb(tx);
    const r = await new AlquileresService(db).resumen();
    expect(r).toEqual({ contratos: 5, contratosVigentes: 3, personas: 9, propiedades: 4 });
    // Por `withTenant`: las tablas tienen RLS y sin contexto no aíslan.
    expect(db.withTenant).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ where: { estado: 'vigente' } });
  });
});
