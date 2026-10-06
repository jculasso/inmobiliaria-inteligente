import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { IndexacionesService } from './indexaciones.service';
import { mocksDeHistorial } from './historial.testing';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/*
 * Contrato #5 de Gexion (IPC, arranca el 15/08/2025): el tramo 4 empieza el
 * 15/08/2026 y se calcula con el IPC de marzo y de julio de 2026 sobre el
 * importe del tramo 3. Gexion muestra 1.137.518.
 */
const IPC = [
  { indice: 'IPC', fecha: d('2026-03-01'), valor: 11_077.0608 },
  { indice: 'IPC', fecha: d('2026-07-01'), valor: 12_076.3937 },
];

function tramo(over: { numero?: number; desde?: string; importe?: number | null; indice?: string; estado?: string; tramos?: unknown[] } = {}) {
  const numero = over.numero ?? 4;
  return {
    id: `tramo-${numero}`,
    numero,
    desde: d(over.desde ?? '2026-08-15'),
    hasta: d('2026-12-14'),
    importe: over.importe ?? null,
    contrato: {
      id: 'c5',
      codigo: '5',
      estado: over.estado ?? 'vigente',
      ajuste: 'indexado',
      indice: over.indice ?? 'IPC',
      propiedad: { direccion: 'Calle 1', unidad: null },
      partes: [{ persona: { nombre: 'Inquilino' } }],
      tramos: over.tramos ?? [
        { numero: 3, desde: d('2026-04-15'), importe: 1_043_387 },
        { numero: 4, desde: d('2026-08-15'), importe: null },
        { numero: 5, desde: d('2026-12-15'), importe: null },
      ],
    },
  };
}

function makeTx(over: { tramos?: unknown[]; tramo?: unknown; valores?: unknown[]; grupos?: unknown[]; actualizados?: number } = {}) {
  return {
    ...mocksDeHistorial(),
    alqTramo: {
      findMany: vi.fn().mockResolvedValue(over.tramos ?? [tramo()]),
      findUnique: vi.fn().mockResolvedValue(over.tramo === undefined ? tramo() : over.tramo),
      updateMany: vi.fn().mockResolvedValue({ count: over.actualizados ?? 1 }),
    },
    indiceValor: {
      findMany: vi.fn().mockResolvedValue(over.valores ?? IPC),
      groupBy: vi.fn().mockResolvedValue(over.grupos ?? []),
    },
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

describe('IndexacionesService.bandeja (reglas 5 a 7)', () => {
  it('propone el importe encadenado, como Gexion', async () => {
    const r = await new IndexacionesService(makeDb(makeTx())).bandeja('2026-08-10');
    expect(r.tramos).toHaveLength(1);
    expect(r.tramos[0]).toMatchObject({
      numero: 4,
      estado: 'lista',
      importeAnterior: 1_043_387,
      fechaBase: '2026-03-01',
      fechaRequerida: '2026-07-01',
      importePropuesto: 1_137_518,
      vencida: false,
    });
  });

  // Regla 5: el tramo 5 se encadena sobre el 4, que todavía no tiene importe.
  it('solo el primer tramo sin importe de cada contrato', async () => {
    const t5 = tramo({ numero: 5, desde: '2026-12-15' });
    const r = await new IndexacionesService(makeDb(makeTx({ tramos: [tramo(), t5] }))).bandeja('2026-12-01');
    expect(r.tramos.map((t) => t.numero)).toEqual([4]);
  });

  // Regla 7.
  it('sin el IPC del mes: pendiente de índice, y nombra el que falta', async () => {
    const r = await new IndexacionesService(makeDb(makeTx({ valores: [IPC[0]] }))).bandeja('2026-08-20');
    expect(r.tramos[0]).toMatchObject({ estado: 'pendiente_indice', falta: ['el IPC de julio de 2026'], importePropuesto: null, vencida: true });
  });

  it('la ventana de anticipación y los contratos que cuentan se piden a la base', async () => {
    const tx = makeTx();
    await new IndexacionesService(makeDb(tx)).bandeja('2026-08-10');
    expect(tx.alqTramo.findMany.mock.calls[0]![0].where).toEqual({
      importe: null,
      desde: { lte: d('2026-09-09') },
      contrato: { estado: 'vigente', ajuste: 'indexado' },
    });
  });

  /*
   * Las consultas no crecen con los tramos: una para los tramos, una para los
   * valores del índice y una para el estado de los índices.
   */
  it('tres consultas con 1 tramo y con 25', async () => {
    const muchos = Array.from({ length: 25 }, () => tramo());
    for (const tramos of [[tramo()], muchos]) {
      const tx = makeTx({ tramos });
      await new IndexacionesService(makeDb(tx)).bandeja('2026-08-10');
      const consultas = tx.alqTramo.findMany.mock.calls.length + tx.indiceValor.findMany.mock.calls.length + tx.indiceValor.groupBy.mock.calls.length;
      expect(consultas).toBe(3);
    }
  });

  // Regla 8: el estado de cada índice viaja con la bandeja.
  it('avisa si el ICL lleva más de 3 días sin valores nuevos', async () => {
    const grupos = [
      { indice: 'ICL', _max: { fecha: d('2026-10-16'), createdAt: new Date('2026-10-05T12:00:00Z') } },
      { indice: 'IPC', _max: { fecha: d('2026-08-01'), createdAt: new Date('2026-09-14T12:00:00Z') } },
    ];
    const r = await new IndexacionesService(makeDb(makeTx({ grupos }))).bandeja('2026-10-09');
    expect(r.indices[0]).toMatchObject({ indice: 'ICL', ultimaFecha: '2026-10-16' });
    expect(r.indices[0]!.alerta).toMatch(/no trae valores nuevos/);
    expect(r.indices[1]).toEqual({ indice: 'IPC', ultimaFecha: '2026-08-01', alerta: null });
  });
});

describe('IndexacionesService.confirmar (regla 6)', () => {
  it('guarda el importe que calcula la API, con los índices usados y quién confirmó', async () => {
    const tx = makeTx();
    const r = await new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe: null });
    expect(r).toEqual({ tramoId: 'tramo-4', numero: 4, importe: 1_137_518 });
    expect(tx.alqTramo.updateMany).toHaveBeenCalledWith({
      where: { id: 'tramo-4', importe: null },
      data: expect.objectContaining({
        importe: 1_137_518,
        importePropuesto: 1_137_518,
        indiceBase: 11_077.0608,
        indiceRequerido: 12_076.3937,
        confirmadoPorId: 'u1',
      }),
    });
  });

  it('un importe distinto del calculado se rechaza, no se ignora', async () => {
    const tx = makeTx();
    await expect(new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe: 1_200_000 })).rejects.toThrow(
      /sale del índice: \$ 1\.137\.518/,
    );
    expect(tx.alqTramo.updateMany).not.toHaveBeenCalled();
  });

  // Regla 7: sin índice no hay nada que confirmar.
  it('sin el índice publicado no se puede confirmar', async () => {
    await expect(new IndexacionesService(makeDb(makeTx({ valores: [] }))).confirmar(CTX, 'tramo-4', { importe: null })).rejects.toThrow(
      /falta el IPC de marzo de 2026 y el IPC de julio de 2026/,
    );
  });

  it('Casa Propia: el importe va a mano y es obligatorio', async () => {
    const ccp = tramo({ indice: 'CCP' });
    const svc = new IndexacionesService(makeDb(makeTx({ tramo: ccp })));
    await expect(svc.confirmar(CTX, 'tramo-4', { importe: null })).rejects.toThrow(/cargá el importe/);
    const tx = makeTx({ tramo: ccp });
    await new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe: 1_150_000.4 });
    expect(tx.alqTramo.updateMany.mock.calls[0]![0].data).toMatchObject({ importe: 1_150_000, importePropuesto: null, indiceBase: null });
  });

  it('no se saltea un tramo: el anterior tiene que estar indexado', async () => {
    const t5 = tramo({ numero: 5, desde: '2026-12-15' });
    await expect(new IndexacionesService(makeDb(makeTx({ tramo: t5 }))).confirmar(CTX, 'tramo-5', { importe: null })).rejects.toThrow(
      /Primero hay que indexar el tramo 4/,
    );
  });

  it('un tramo ya indexado, o que otra persona confirmó recién, no se pisa', async () => {
    await expect(
      new IndexacionesService(makeDb(makeTx({ tramo: tramo({ importe: 1 }) }))).confirmar(CTX, 'tramo-4', { importe: null }),
    ).rejects.toThrow(ConflictException);
    await expect(new IndexacionesService(makeDb(makeTx({ actualizados: 0 }))).confirmar(CTX, 'tramo-4', { importe: null })).rejects.toThrow(
      /Otra persona/,
    );
  });

  it('un contrato que no está vigente no se indexa', async () => {
    await expect(
      new IndexacionesService(makeDb(makeTx({ tramo: tramo({ estado: 'borrador' }) }))).confirmar(CTX, 'tramo-4', { importe: null }),
    ).rejects.toThrow(BadRequestException);
  });
});
