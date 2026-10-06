import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { IndicesConsultaService } from './indices-consulta.service';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const makeDb = (tx: unknown) => ({ withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) }) as unknown as TenantPrismaService;

describe('IndicesConsultaService (punto 3 de Javier)', () => {
  it('IPC: cada mes con su variación mensual e interanual, lo más nuevo primero', async () => {
    const meses = Array.from({ length: 14 }, (_, i) => ({ fecha: d(`${2025 + Math.floor((i + 7) / 12)}-${String(((i + 7) % 12) + 1).padStart(2, '0')}-01`), valor: new Prisma.Decimal(100 * 1.02 ** i) }));
    const tx = {
      indiceValor: {
        findFirst: vi.fn().mockResolvedValue({ fecha: meses.at(-1)!.fecha, createdAt: new Date('2026-09-15T12:00:00Z') }),
        findMany: vi.fn().mockResolvedValue(meses),
      },
    };
    const r = await new IndicesConsultaService(makeDb(tx)).listar({ indice: 'IPC' });
    expect(r.fuente).toMatch(/INDEC/);
    expect(r.ultimaFecha).toBe('2026-09-01');
    expect(r.valores[0]).toMatchObject({ fecha: '2026-09-01', variacionMensual: 2, variacionInteranual: 26.82 });
    // El primero no tiene mes anterior con qué compararse.
    expect(r.valores.at(-1)).toMatchObject({ fecha: '2025-08-01', variacionMensual: null, variacionInteranual: null });
  });

  it('ICL: por rango, y nunca más de un año y un mes de una vez', async () => {
    const tx = {
      indiceValor: {
        findFirst: vi.fn().mockResolvedValue({ fecha: d('2026-10-05'), createdAt: new Date() }),
        findMany: vi.fn().mockResolvedValue([{ fecha: d('2026-10-05'), valor: new Prisma.Decimal(28.5) }]),
      },
    };
    await new IndicesConsultaService(makeDb(tx)).listar({ indice: 'ICL', desde: '2020-01-01', hasta: '2026-10-05' });
    const where = tx.indiceValor.findMany.mock.calls[0]![0].where;
    expect(where.fecha.gte.toISOString().slice(0, 10)).toBe('2025-08-31');
    expect(where.fecha.lte.toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('sin el rango, los últimos 60 días cargados', async () => {
    const tx = { indiceValor: { findFirst: vi.fn().mockResolvedValue({ fecha: d('2026-10-05'), createdAt: new Date() }), findMany: vi.fn().mockResolvedValue([]) } };
    await new IndicesConsultaService(makeDb(tx)).listar({ indice: 'ICL' });
    expect(tx.indiceValor.findMany.mock.calls[0]![0].where.fecha.gte.toISOString().slice(0, 10)).toBe('2026-08-07');
  });
});
