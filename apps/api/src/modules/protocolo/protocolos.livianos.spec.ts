import { describe, expect, it, vi } from 'vitest';
import { AccionActualizadaSchema } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import { ProtocolosService } from './protocolos.service';
import { hoyArgentina } from './protocolo.calc';

const CTX: TenantContext = { tenantId: 't1', userId: 'ceo', roles: ['admin_tenant'] };

function makeDb(tx: unknown) {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as never;
}
const storage = {
  signedUrls: vi.fn().mockResolvedValue([]),
  keyDe: (_b: string, s: string) => s,
} as never;

/** Una fecha `dias` antes de hoy en Argentina, como Date UTC de la base. */
function haceDias(dias: number): Date {
  const d = new Date(`${hoyArgentina()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d;
}

describe('Protocolo · KPIs', () => {
  function armar(activas: unknown[]) {
    const tx = {
      protocolo: {
        groupBy: vi.fn().mockResolvedValue([
          { estado: 'activa', _count: { _all: 640 } },
          { estado: 'archivada', _count: { _all: 75 } },
        ]),
        findMany: vi.fn().mockResolvedValue(activas),
      },
      tasacion: { count: vi.fn().mockResolvedValue(4) },
    };
    return { svc: new ProtocolosService(makeDb(tx), storage), tx };
  }

  // Se contaban sobre un findMany con take 501 y sin orden: pasadas las 500
  // fichas, los números eran de un subconjunto cualquiera.
  it('los contadores salen de groupBy/count, exactos', async () => {
    const { svc } = armar([]);
    const k = await svc.kpis(true, CTX);
    expect(k).toMatchObject({ activas: 640, archivadas: 75, captadasSinIniciar: 4 });
  });

  // La tarjeta decía 0 mientras la lista mostraba la ficha en rojo: una acción
  // sin fecha de una semana que ya pasó está demorada (`estaDemorada`).
  it('«alertas críticas» usa el mismo criterio que la alerta roja de la ficha', async () => {
    const { svc } = armar([
      {
        fechaInicio: haceDias(30), // semana 5
        acciones: [{ semana: 1, estado: 'pendiente', fechaPrevista: null }],
      },
      {
        fechaInicio: haceDias(1), // semana 1, todo en fecha
        acciones: [{ semana: 1, estado: 'pendiente', fechaPrevista: null }],
      },
    ]);
    const k = await svc.kpis(true, CTX);
    expect(k.alertasCriticas).toBe(1);
  });

  it('las acciones se traen solo de las activas, ordenadas y con tope', async () => {
    const { svc, tx } = armar([]);
    await svc.kpis(true, CTX);
    const arg = tx.protocolo.findMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.where).toMatchObject({ estado: 'activa' });
    expect(arg.orderBy).toBeDefined();
  });
});

describe('Protocolo · listado liviano', () => {
  it('las acciones del listado traen solo lo que usa el resumen', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tx = { protocolo: { findMany }, usuario: { findMany: vi.fn() } };
    await new ProtocolosService(makeDb(tx), storage).list({}, CTX);
    const acciones = (findMany.mock.calls[0]![0] as { include: { acciones: { select: object } } })
      .include.acciones;
    expect(Object.keys(acciones.select).sort()).toEqual([
      'estado',
      'fechaPrevista',
      'semana',
      'titulo',
    ]);
  });
});

describe('Protocolo · tilde liviano', () => {
  function armar() {
    const accion = {
      id: '00000000-0000-4000-8000-000000000001',
      semana: 1,
      orden: 1,
      clave: 'fotos',
      titulo: 'Fotos profesionales',
      estado: 'realizada',
      fechaPrevista: haceDias(2),
      fechaRealizada: haceDias(0),
      observaciones: null,
      resultado: null,
      evidencia: null,
    };
    const updatedAt = new Date('2026-10-06T12:00:00.000Z');
    const tx = {
      protocoloAccion: {
        findUnique: vi.fn().mockResolvedValue({
          protocoloId: 'p1',
          fechaRealizada: null,
          protocolo: { agenteId: 'u1' },
        }),
        update: vi.fn().mockResolvedValue(accion),
      },
      protocolo: {
        update: vi.fn().mockResolvedValue({
          estado: 'activa',
          fechaInicio: haceDias(3),
          vencimientoAutorizacion: null,
          updatedAt,
          consultas: 0,
          visitas: 0,
          acciones: [
            {
              semana: 1,
              estado: 'realizada',
              fechaPrevista: haceDias(2),
              titulo: 'Fotos profesionales',
            },
            { semana: 2, estado: 'pendiente', fechaPrevista: haceDias(-5), titulo: 'Publicar' },
          ],
        }),
      },
    };
    return { svc: new ProtocolosService(makeDb(tx), storage), tx, updatedAt };
  }

  it('devuelve la acción, la versión nueva y lo que se recalcula, no la ficha entera', async () => {
    const { svc, updatedAt } = armar();
    const r = await svc.updateAccionLiviana('p1', 'a1', { estado: 'realizada' }, CTX);
    expect(AccionActualizadaSchema.safeParse(r).success).toBe(true);
    expect(r.version).toBe(updatedAt.toISOString());
    expect(r.avance).toBe(0.5);
    expect(r.proximaAccion).toBe('Publicar');
    expect(r).not.toHaveProperty('propiedad');
  });

  it('la ficha se relee con un select mínimo, sin tasación ni agente', async () => {
    const { svc, tx } = armar();
    await svc.updateAccionLiviana('p1', 'a1', { estado: 'realizada' }, CTX);
    const arg = tx.protocolo.update.mock.calls[0]![0] as { select?: object; include?: object };
    expect(arg.include).toBeUndefined();
    expect(arg.select).not.toHaveProperty('tasacion');
    expect(arg.select).not.toHaveProperty('agente');
  });
});
