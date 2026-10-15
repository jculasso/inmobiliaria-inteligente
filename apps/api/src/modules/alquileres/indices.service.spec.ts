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
    const llamadas = prisma.indiceValor.createMany.mock.calls as unknown as [
      { data: { indice: string }[] },
    ][];
    const ipc = llamadas.find((c) => c[0].data[0]?.indice === 'IPC')!;
    expect(ipc[0]).toMatchObject({
      skipDuplicates: true,
      data: [{ indice: 'IPC', fecha: fecha('2026-09-01'), valor: 12_500.1234 }],
    });
    expect(r.find((x) => x.indice === 'IPC')).toEqual({
      indice: 'IPC',
      nuevos: 1,
      ultimaFecha: '2026-09-01',
    });
  });

  // Que el BCRA no responda no frena al IPC, y el error queda en el resultado.
  it('una fuente caída no frena a la otra', async () => {
    const prisma = makePrisma({ ICL: '2026-10-16', IPC: '2026-08-01' });
    const fuentes = makeFuentes({
      ICL: new Error('BCRA respondió 503.'),
      IPC: [{ fecha: '2026-09-01', valor: 1 }],
    });
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
    const { f, http } = conRespuesta({
      results: [{ detalle: [{ fecha: '2026-10-16', valor: 36.88 }] }],
    });
    expect(await f.traer('ICL', '2026-10-17', '2026-10-05')).toEqual([
      { fecha: '2026-10-16', valor: 36.88 },
    ]);
    expect(String(http.mock.calls[0]![0])).toContain('desde=2026-10-05&hasta=2026-12-04');
  });

  it('IPC: lee el formato de datos.gob.ar', async () => {
    const { f } = conRespuesta({ data: [['2026-08-01', 12276.766]] });
    expect(await f.traer('IPC', '2026-08-01', '2026-10-05')).toEqual([
      { fecha: '2026-08-01', valor: 12276.766 },
    ]);
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

describe('IndicesService.importarFeriados (regla 101)', () => {
  /** La tabla `feriado` en memoria, para ver qué quedó después de cada corrida. */
  function makePrisma(cargados: string[]) {
    const tabla = new Set(cargados);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const enRango = (f: string, r: { gte: Date; lte: Date }) => f >= iso(r.gte) && f <= iso(r.lte);
    const feriado = {
      deleteMany: vi.fn(
        async ({ where }: { where: { fecha: { gte: Date; lte: Date; notIn: Date[] } } }) => {
          const quedan = new Set(where.fecha.notIn.map(iso));
          let count = 0;
          for (const f of [...tabla])
            if (enRango(f, where.fecha) && !quedan.has(f)) {
              tabla.delete(f);
              count++;
            }
          return { count };
        },
      ),
      createMany: vi.fn(async ({ data }: { data: { fecha: Date }[] }) => {
        let count = 0;
        for (const x of data) {
          if (!tabla.has(iso(x.fecha))) count++;
          tabla.add(iso(x.fecha));
        }
        return { count };
      }),
      count: vi.fn(
        async ({ where }: { where: { fecha: { gte: Date; lte: Date } } }) =>
          [...tabla].filter((f) => enRango(f, where.fecha)).length,
      ),
      aggregate: vi.fn(async () => ({
        _max: { fecha: tabla.size ? fecha([...tabla].sort().at(-1)!) : null },
      })),
    };
    return {
      tabla,
      prisma: {
        feriado,
        // Las dos operaciones de cada año van juntas: se ejecutan en orden.
        $transaction: vi.fn(async (ops: Promise<unknown>[]) => {
          const r = [];
          for (const op of ops) r.push(await op);
          return r;
        }),
      },
    };
  }
  type Traido = { fecha: string; nombre: string; tipo: string };
  const fuentes = (porAnio: Record<number, Traido[] | Error>) => ({
    feriados: vi.fn(async (anio: number) => {
      const r = porAnio[anio] ?? [];
      if (r instanceof Error) throw r;
      return r;
    }),
  });
  const f = (fecha: string, tipo = 'inamovible'): Traido => ({ fecha, nombre: 'Feriado', tipo });
  const importar = (prisma: unknown, src: unknown) =>
    new IndicesService(prisma as never, src as never).importarFeriados('2026-10-15');

  it('trae el año en curso y el siguiente, y carga los nuevos', async () => {
    const { prisma, tabla } = makePrisma([]);
    const src = fuentes({
      2026: [f('2026-10-12'), f('2026-12-07', 'puente')],
      2027: [f('2027-01-01')],
    });
    const r = await importar(prisma, src);
    expect(src.feriados.mock.calls.map((c) => c[0])).toEqual([2026, 2027]);
    expect([...tabla].sort()).toEqual(['2026-10-12', '2026-12-07', '2027-01-01']);
    expect(r).toEqual({ indice: 'Feriados', nuevos: 3, ultimaFecha: '2027-01-01' });
  });

  it('un trasladable que se movió sale de su fecha vieja y entra en la nueva', async () => {
    const { prisma, tabla } = makePrisma(['2027-06-17', '2027-01-01']);
    const src = fuentes({
      2026: [f('2026-10-12')],
      2027: [f('2027-01-01'), f('2027-06-14', 'trasladable')],
    });
    await importar(prisma, src);
    expect([...tabla].sort()).toEqual(['2026-10-12', '2027-01-01', '2027-06-14']);
  });

  it('una respuesta vacía no borra los feriados de ese año', async () => {
    const { prisma, tabla } = makePrisma(['2026-10-12', '2027-01-01']);
    const r = await importar(prisma, fuentes({ 2026: [], 2027: [f('2027-01-01')] }));
    expect([...tabla].sort()).toEqual(['2026-10-12', '2027-01-01']);
    expect(r.error).toBeUndefined();
    expect(r.aviso).toMatch(/2026: la fuente no trajo ningún feriado/);
  });

  it('si la fuente no responde pero los dos años están cargados, es un aviso: la corrida no falla', async () => {
    const { prisma } = makePrisma(['2026-10-12', '2027-01-01']);
    const caida = new Error('respondió 503.');
    const r = await importar(prisma, fuentes({ 2026: caida, 2027: caida }));
    expect(r.error).toBeUndefined();
    expect(r.aviso).toBe('2026: respondió 503. · 2027: respondió 503.');
  });

  it('si un año queda sin un solo feriado, es un error: el workflow falla y avisa', async () => {
    const { prisma } = makePrisma(['2026-10-12']);
    const r = await importar(
      prisma,
      fuentes({ 2026: [f('2026-10-12')], 2027: new Error('respondió 503.') }),
    );
    expect(r.error).toMatch(/^Sin feriados cargados de 2027/);
  });

  it('lee el formato de argentinadatos.com y se queda con los del año pedido', async () => {
    const fu = new FuentesIndices();
    const diversidad = {
      fecha: '2026-10-12',
      tipo: 'trasladable',
      nombre: 'Día del Respeto a la Diversidad Cultural',
    };
    const http = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify([
            diversidad,
            { fecha: '2027-01-01', tipo: 'inamovible', nombre: 'Año nuevo' },
          ]),
        ),
    );
    fu.http = http as never;
    expect(await fu.feriados(2026)).toEqual([diversidad]);
    expect(String(http.mock.calls[0]![0])).toBe('https://api.argentinadatos.com/v1/feriados/2026');
  });
});
