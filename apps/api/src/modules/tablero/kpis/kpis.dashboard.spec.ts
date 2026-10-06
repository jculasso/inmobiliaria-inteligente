import { describe, expect, it, vi } from 'vitest';
import { DashboardTableroSchema, type KpiFiltro } from '@vacker/types';
import type { TenantContext } from '../../../prisma/tenant-context';
import { KpisService } from './kpis.service';

/**
 * El dashboard junta en un pedido lo que la portada pedía en cuatro. La
 * promesa es que da EXACTAMENTE lo mismo que los endpoints viejos sobre los
 * mismos datos — si no, la portada y las otras pantallas mostrarían números
 * distintos para la misma cosa.
 */

interface Punta {
  usuarioId: string;
  lado: 'vendedora' | 'compradora';
  comision: number;
}
interface Op {
  id: string;
  tipo: 'venta' | 'alquiler';
  estado: string;
  anio: number;
  mes: number;
  precio?: number;
  comTotal?: number;
  valorMensual?: number;
  puntas: Punta[];
}

const NOMBRES: Record<string, string> = { ana: 'Ana', beto: 'Beto', ceci: 'Ceci' };

const OPS: Op[] = [
  {
    id: 'v1',
    tipo: 'venta',
    estado: 'escriturada',
    anio: 2026,
    mes: 1,
    precio: 100_000,
    puntas: [
      { usuarioId: 'ana', lado: 'vendedora', comision: 3000 },
      { usuarioId: 'beto', lado: 'compradora', comision: 2000 },
    ],
  },
  {
    id: 'v2',
    tipo: 'venta',
    estado: 'escriturada',
    anio: 2026,
    mes: 3,
    precio: 250_000,
    puntas: [{ usuarioId: 'ceci', lado: 'vendedora', comision: 7500 }],
  },
  {
    id: 'v3',
    tipo: 'venta',
    estado: 'escriturada',
    anio: 2026,
    mes: 3,
    precio: 80_000,
    puntas: [{ usuarioId: 'ana', lado: 'compradora', comision: 1600 }],
  },
  {
    id: 'v4',
    tipo: 'venta',
    estado: 'senada',
    anio: 2026,
    mes: 5,
    precio: 120_000,
    puntas: [
      { usuarioId: 'beto', lado: 'vendedora', comision: 3600 },
      { usuarioId: 'ceci', lado: 'compradora', comision: 2400 },
    ],
  },
  {
    id: 'v5',
    tipo: 'venta',
    estado: 'escriturada',
    anio: 2025,
    mes: 3,
    precio: 999_999,
    puntas: [{ usuarioId: 'ana', lado: 'vendedora', comision: 1 }],
  },
  {
    id: 'a1',
    tipo: 'alquiler',
    estado: 'firmado',
    anio: 2026,
    mes: 2,
    comTotal: 500,
    valorMensual: 400,
    puntas: [],
  },
  {
    id: 'a2',
    tipo: 'alquiler',
    estado: 'firmado',
    anio: 2026,
    mes: 2,
    comTotal: 700,
    valorMensual: 600,
    puntas: [],
  },
];

interface Where {
  tipo?: string;
  estado?: string | { in: string[] };
  anio?: number;
  puntas?: { some: { usuarioId: { in: string[] } } };
}

function fakeDb() {
  const findMany = vi.fn(async ({ where }: { where: Where }) =>
    OPS.filter((o) => {
      if (where.tipo && o.tipo !== where.tipo) return false;
      if (typeof where.estado === 'string' && o.estado !== where.estado) return false;
      if (typeof where.estado === 'object' && !where.estado.in.includes(o.estado)) return false;
      if (where.anio != null && o.anio !== where.anio) return false;
      const ids = where.puntas?.some.usuarioId.in;
      if (ids && !o.puntas.some((p) => ids.includes(p.usuarioId))) return false;
      return true;
    }).map((o) => ({
      ...o,
      puntas: o.puntas.map((p) => ({
        ...p,
        usuario: { id: p.usuarioId, nombre: NOMBRES[p.usuarioId]!, fotoUrl: null },
      })),
    })),
  );
  const tx = {
    operacion: { findMany },
    // Team leader: él + su equipo.
    usuario: { findMany: vi.fn(async () => [{ id: 'beto' }, { id: 'ana' }]) },
  };
  const db = { withTenant: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { db, findMany };
}

const CASOS: [string, TenantContext, boolean][] = [
  ['admin (ve todo)', { tenantId: 't', userId: 'adm', roles: ['admin_tenant'] }, false],
  ['dirección, solo lo suyo', { tenantId: 't', userId: 'ana', roles: ['direccion'] }, false],
  ['dirección con ver todo', { tenantId: 't', userId: 'ana', roles: ['direccion'] }, true],
  ['vendedor', { tenantId: 't', userId: 'ceci', roles: ['vendedor'] }, false],
  ['team leader con ver todo', { tenantId: 't', userId: 'beto', roles: ['team_leader'] }, true],
];

describe('GET /tablero/kpis/dashboard', () => {
  it.each(CASOS)('%s: es igual a componer los endpoints viejos', async (_n, ctx, verTodo) => {
    const filtro: KpiFiltro = { anio: 2026, mes: 3, verTodo };
    const { db } = fakeDb();
    const svc = new KpisService(db as never);

    const dashboard = await svc.dashboard(filtro, ctx);

    const resumen = await svc.resumen(filtro, ctx);
    const anual = await svc.resumenRango(2026, 1, 12, ctx, verTodo);
    const mensual = await svc.mensual(2026, ctx, verTodo);
    const puedeAlquileres = ctx.roles.some((r) => r === 'direccion' || r === 'admin_tenant');
    const alquileres = puedeAlquileres ? await svc.alquileresMensual(2026) : null;

    expect(dashboard).toEqual({ resumen, anual, mensual, alquileres });
    expect(DashboardTableroSchema.safeParse(dashboard).success).toBe(true);
  });

  it('una sola consulta de ventas y una de alquileres, en una transacción', async () => {
    const { db, findMany } = fakeDb();
    const svc = new KpisService(db as never);
    await svc.dashboard({ anio: 2026, mes: 3 }, CASOS[0]![1]);
    expect(db.withTenant).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('a quien no puede ver alquileres le llega null, y no consulta', async () => {
    const { db, findMany } = fakeDb();
    const svc = new KpisService(db as never);
    const r = await svc.dashboard({ anio: 2026, mes: 3 }, CASOS[3]![1]);
    expect(r.alquileres).toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('los números tienen sentido sobre el fixture (no solo que coinciden)', async () => {
    const { db } = fakeDb();
    const svc = new KpisService(db as never);
    const r = await svc.dashboard({ anio: 2026, mes: 3 }, CASOS[0]![1]);
    // v1 (2 puntas × 100k) + v2 (250k) + v3 (80k); v5 es de 2025.
    expect(r.anual.agregado.volumen).toBe(530_000);
    expect(r.mensual[2]!.volumen).toBe(330_000);
    expect(r.resumen.pendienteCobro).toBe(6000);
    expect(r.alquileres![1]).toMatchObject({ firmados: 2, comision: 1200 });
  });
});
