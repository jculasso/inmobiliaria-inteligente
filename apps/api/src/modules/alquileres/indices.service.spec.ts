import { describe, expect, it, vi } from 'vitest';
import { FuentesIndices, IndicesService, type ValorIndice } from './indices.service';

const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makePrisma(ultima: Record<string, string | null>) {
  return {
    indiceValor: {
      aggregate: vi.fn(async ({ where }: { where: { indice: string } }) => ({
        _max: { fecha: ultima[where.indice] ? fecha(ultima[where.indice]!) : null },
      })),
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
  };
}

function makeFuentes(respuestas: Partial<Record<'ICL' | 'IPC', ValorIndice[] | Error>>) {
  return {
    traer: vi.fn(async (indice: 'ICL' | 'IPC') => {
      const r = respuestas[indice] ?? [];
      if (r instanceof Error) throw r;
      return r;
    }),
  };
}

describe('IndicesService.importar (regla 8)', () => {
  it('la primera vez trae toda la historia de cada índice', async () => {
    const prisma = makePrisma({ ICL: null, IPC: null });
    const fuentes = makeFuentes({});
    await new IndicesService(prisma as never, fuentes as never).importar('2026-10-05');
    expect(fuentes.traer).toHaveBeenCalledWith('ICL', '2020-06-30', '2026-10-05');
    expect(fuentes.traer).toHaveBeenCalledWith('IPC', '2016-12-01', '2026-10-05');
  });

  it('después, desde el día siguiente al último cargado', async () => {
    const prisma = makePrisma({ ICL: '2026-10-16', IPC: '2026-08-01' });
    const fuentes = makeFuentes({});
    await new IndicesService(prisma as never, fuentes as never).importar('2026-10-05');
    expect(fuentes.traer).toHaveBeenCalledWith('ICL', '2026-10-17', '2026-10-05');
  });

  // Un valor ya cargado no se pisa: ni se manda, ni se sobreescribe si se manda.
  it('no pisa lo cargado: filtra lo viejo y pide saltear duplicados', async () => {
    const prisma = makePrisma({ ICL: null, IPC: '2026-08-01' });
    const fuentes = makeFuentes({
      IPC: [
        { fecha: '2026-08-01', valor: 99_999 }, // revisado por la fuente: no se toca
        { fecha: '2026-09-01', valor: 12_500.1234 },
      ],
    });
    const r = await new IndicesService(prisma as never, fuentes as never).importar('2026-10-15');
    const llamadas = prisma.indiceValor.createMany.mock.calls as unknown as [{ data: { indice: string }[] }][];
    const ipc = llamadas.find((c) => c[0].data[0]?.indice === 'IPC')!;
    expect(ipc[0]).toMatchObject({
      skipDuplicates: true,
      data: [{ indice: 'IPC', fecha: fecha('2026-09-01'), valor: 12_500.1234 }],
    });
    expect(r.find((x) => x.indice === 'IPC')).toEqual({ indice: 'IPC', nuevos: 1, ultimaFecha: '2026-09-01' });
  });

  // Que el BCRA no responda no frena al IPC, y el error queda en el resultado.
  it('una fuente caída no frena a la otra', async () => {
    const prisma = makePrisma({ ICL: '2026-10-16', IPC: '2026-08-01' });
    const fuentes = makeFuentes({ ICL: new Error('BCRA respondió 503.'), IPC: [{ fecha: '2026-09-01', valor: 1 }] });
    const r = await new IndicesService(prisma as never, fuentes as never).importar('2026-10-15');
    expect(r).toEqual([
      { indice: 'ICL', nuevos: 0, ultimaFecha: '2026-10-16', error: 'BCRA respondió 503.' },
      { indice: 'IPC', nuevos: 1, ultimaFecha: '2026-09-01' },
    ]);
  });
});

describe('FuentesIndices', () => {
  function conRespuesta(json: unknown, status = 200) {
    const f = new FuentesIndices();
    const http = vi.fn(async (_url: string) => new Response(JSON.stringify(json), { status }));
    f.http = http as never;
    return { f, http };
  }

  it('ICL: lee el formato del BCRA y nunca pide desde una fecha futura', async () => {
    const { f, http } = conRespuesta({ results: [{ detalle: [{ fecha: '2026-10-16', valor: 36.88 }] }] });
    expect(await f.traer('ICL', '2026-10-17', '2026-10-05')).toEqual([{ fecha: '2026-10-16', valor: 36.88 }]);
    expect(String(http.mock.calls[0]![0])).toContain('desde=2026-10-05&hasta=2026-12-04');
  });

  it('IPC: lee el formato de datos.gob.ar', async () => {
    const { f } = conRespuesta({ data: [['2026-08-01', 12276.766]] });
    expect(await f.traer('IPC', '2026-08-01', '2026-10-05')).toEqual([{ fecha: '2026-08-01', valor: 12276.766 }]);
  });

  // Un valor en cero o negativo indexaría todos los contratos mal: no entra.
  it('rechaza una respuesta con un valor que no es positivo', async () => {
    const { f } = conRespuesta({ data: [['2026-08-01', 0]] });
    await expect(f.traer('IPC', '2026-08-01', '2026-10-05')).rejects.toThrow();
  });

  it('un status de error se informa con la fuente', async () => {
    const { f } = conRespuesta({}, 503);
    await expect(f.traer('ICL', '2026-10-01', '2026-10-05')).rejects.toThrow('BCRA respondió 503.');
  });
});
