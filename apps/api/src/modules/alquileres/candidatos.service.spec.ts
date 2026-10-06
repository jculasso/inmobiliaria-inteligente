import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { CandidatosService } from './candidatos.service';
import type { LiquidacionesService } from './liquidaciones.service';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const parte = (persona: number, nombre: string, contrato: number) => ({
  persona: { id: u(persona), nombre },
  contrato: { id: u(100 + contrato), codigo: `ALT-${String(contrato).padStart(4, '0')}`, codigoNum: new Prisma.Decimal(contrato), propiedad: { direccion: `Calle ${contrato}`, unidad: null } },
});

function makeTx(partes: unknown[], deudas: unknown[] = []) {
  return { alqContratoParte: { findMany: vi.fn().mockResolvedValue(partes) }, $queryRaw: vi.fn().mockResolvedValue(deudas) };
}
const makeDb = (tx: unknown) => ({ withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) }) as unknown as TenantPrismaService;
const sinLiquidaciones = { pendientes: vi.fn().mockResolvedValue([]) } as unknown as LiquidacionesService;

describe('CandidatosService (punto 6 de Javier)', () => {
  it('inquilinos con sus contratos; primero los que deben, de mayor a menor', async () => {
    const tx = makeTx(
      [parte(1, 'Ana', 1), parte(2, 'Bruno', 2), parte(3, 'Carla', 3), parte(2, 'Bruno', 4)],
      [
        { persona_id: u(3), moneda: 'ARS', pendiente: new Prisma.Decimal(100) },
        { persona_id: u(2), moneda: 'ARS', pendiente: new Prisma.Decimal(900) },
      ],
    );
    const r = await new CandidatosService(makeDb(tx), sinLiquidaciones).listar('inquilino');
    expect(r.map((c) => c.persona.nombre)).toEqual(['Bruno', 'Carla', 'Ana']);
    expect(r[0]).toMatchObject({ papel: 'inquilino', contratos: [{ codigo: 'ALT-0002', propiedad: 'Calle 2' }, { codigo: 'ALT-0004' }], pendiente: [{ moneda: 'ARS', importe: 900 }] });
    expect(tx.alqContratoParte.findMany.mock.calls[0]![0].where).toEqual({ papel: 'inquilino', contrato: { estado: { notIn: ['borrador', 'anulado'] } } });
  });

  it('propietarios con lo que hay para liquidarles, sacado de la bandeja', async () => {
    const tx = makeTx([parte(5, 'Dueño', 1), parte(6, 'Otra Dueña', 2)]);
    const liq = { pendientes: vi.fn().mockResolvedValue([{ persona: { id: u(6), nombre: 'Otra Dueña' }, moneda: 'ARS', neto: 500, enEspera: 0, contratos: [] }]) } as unknown as LiquidacionesService;
    const r = await new CandidatosService(makeDb(tx), liq).listar('propietario');
    expect(r.map((c) => [c.persona.nombre, c.pendiente])).toEqual([
      ['Otra Dueña', [{ moneda: 'ARS', importe: 500 }]],
      ['Dueño', []],
    ]);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  // La trampa de performance: las consultas no crecen con los contratos.
  it('las mismas consultas con 5 inquilinos y con 50', async () => {
    const consultas = async (n: number) => {
      const tx = makeTx(Array.from({ length: n }, (_, i) => parte(i + 1, `P${i}`, i + 1)));
      await new CandidatosService(makeDb(tx), sinLiquidaciones).listar('inquilino');
      return tx.alqContratoParte.findMany.mock.calls.length + tx.$queryRaw.mock.calls.length;
    };
    expect(await consultas(5)).toBe(await consultas(50));
  });
});
