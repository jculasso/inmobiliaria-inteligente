import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  DashboardTasadorSchema,
  LIMITE_LISTA_CON_SONDA,
  type TasadorKpiFiltro,
} from '@vacker/types';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import type { TenantContext } from '../../../prisma/tenant-context';
import { KpisService } from './kpis.service';
import { TasacionesService } from '../tasaciones/tasaciones.service';
import { TasacionesController } from '../tasaciones/tasaciones.controller';

interface Fila {
  id: string;
  agenteId: string;
  estado: string;
  fecha: Date;
  agente: { nombre: string; fotoUrl: null };
}

const f = (id: string, agenteId: string, estado: string, iso: string): Fila => ({
  id,
  agenteId,
  estado,
  fecha: new Date(`${iso}T00:00:00Z`),
  agente: { nombre: agenteId.toUpperCase(), fotoUrl: null },
});

const FILAS: Fila[] = [
  f('t1', 'ana', 'Captada', '2026-01-10'),
  f('t2', 'ana', 'En proceso', '2026-02-03'),
  f('t3', 'beto', 'Captada', '2026-02-20'),
  f('t4', 'beto', 'No captada', '2026-05-05'),
  f('t5', 'ceci', 'Captada', '2026-11-30'),
  f('t6', 'ana', 'Captada', '2025-12-31'),
];

function fakeDb() {
  const findMany = vi.fn(
    async ({ where }: { where: { fecha: { gte: Date; lt: Date }; agenteId?: { in: string[] } } }) =>
      FILAS.filter(
        (r) =>
          r.fecha >= where.fecha.gte &&
          r.fecha < where.fecha.lt &&
          (!where.agenteId || where.agenteId.in.includes(r.agenteId)),
      ),
  );
  const tx = { tasacion: { findMany }, usuario: { findMany: vi.fn(async () => [{ id: 'beto' }]) } };
  const db = { withTenant: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { db, findMany };
}

const ADMIN: TenantContext = { tenantId: 't', userId: 'adm', roles: ['admin_tenant'] };
const VENDEDORA: TenantContext = { tenantId: 't', userId: 'ana', roles: ['vendedor'] };

const FILTROS: [string, TasadorKpiFiltro][] = [
  ['anual', { anio: 2026, periodo: 'anual' }],
  ['trimestral', { anio: 2026, periodo: 'trimestral', trimestre: 1 }],
  ['mensual', { anio: 2026, periodo: 'mensual', mes: 2 }],
];

describe('GET /tasador/kpis/dashboard', () => {
  for (const [nombreCtx, ctx] of [
    ['admin', ADMIN],
    ['vendedora', VENDEDORA],
  ] as const) {
    it.each(FILTROS)(
      `${nombreCtx}, %s: igual a resumen + ranking + mensual`,
      async (_n, filtro) => {
        const { db } = fakeDb();
        const svc = new KpisService(db as never);
        const dashboard = await svc.dashboard(filtro, ctx);
        expect(dashboard).toEqual({
          resumen: await svc.resumen(filtro, ctx),
          ranking: await svc.ranking(filtro, ctx),
          mensual: await svc.mensual(2026, ctx, false),
        });
        expect(DashboardTasadorSchema.safeParse(dashboard).success).toBe(true);
      },
    );
  }

  it('una sola consulta en una sola transacción', async () => {
    const { db, findMany } = fakeDb();
    await new KpisService(db as never).dashboard(FILTROS[2]![1], ADMIN);
    expect(db.withTenant).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe('Listado de tasaciones', () => {
  function armar() {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      withTenant: async (fn: (t: unknown) => unknown) => fn({ tasacion: { findMany } }),
    };
    const svc = new TasacionesService(db as never, {} as never, {} as never);
    return { svc, findMany };
  }

  it('`limite` pide solo las últimas N', async () => {
    const { svc, findMany } = armar();
    await svc.listResumen({ anio: 2026, limite: 5 }, ADMIN);
    expect(findMany.mock.calls[0]![0]).toMatchObject({ take: 5, orderBy: [{ fecha: 'desc' }] });
  });

  it('sin límite, el tope general con su fila de sonda', async () => {
    const { svc, findMany } = armar();
    await svc.listResumen({ anio: 2026 }, ADMIN);
    expect(findMany.mock.calls[0]![0]).toMatchObject({ take: LIMITE_LISTA_CON_SONDA });
  });

  // Devolvía comparables y fotos de hasta 501 tasaciones y ninguna pantalla
  // lo usaba: la ficha completa se pide de a una.
  it('ya no existe el GET /tasador/tasaciones pesado', () => {
    const proto = TasacionesController.prototype as unknown as Record<string, object>;
    const rutasGet = Object.getOwnPropertyNames(proto)
      .filter((m) => m !== 'constructor')
      .filter((m) => Reflect.getMetadata(METHOD_METADATA, proto[m]!) === 0) // GET
      .map((m) => Reflect.getMetadata(PATH_METADATA, proto[m]!) as string);
    expect(rutasGet).not.toContain('/');
    expect(rutasGet).toContain('resumen');
  });
});
