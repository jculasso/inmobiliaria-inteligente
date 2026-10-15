import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { claveParcialDeFinal, generarPeriodo, generarPeriodoConParciales } from '@vacker/domain';
import { aParaGenerar } from './conceptos.service';
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

function tramo(
  over: {
    numero?: number;
    desde?: string;
    importe?: number | null;
    indice?: string;
    estado?: string;
    tramos?: unknown[];
  } = {},
) {
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

const dec = (n: number) => new Prisma.Decimal(n);
const INQ = '11111111-1111-4111-8111-111111111111';
const DUENO_A = '22222222-2222-4222-8222-222222222222';
const DUENO_B = '33333333-3333-4333-8333-333333333333';

/** El contrato #5 con dos dueños al 50%, como lo lee la liquidación final. */
function contratoCompleto(indice = 'IPC') {
  return {
    id: 'c5',
    codigo: '5',
    estado: 'vigente',
    moneda: 'ARS',
    ajuste: 'indexado',
    indice,
    inicio: d('2025-08-15'),
    fin: d('2027-08-14'),
    rescindidoEl: null,
    diaVencimiento: 5,
    diaPagoPropietario: 10,
    honorariosPct: dec(8),
    gastosAdmPct: dec(2),
    ivaPct: dec(0),
    partes: [
      { personaId: DUENO_A, papel: 'propietario', porcentaje: dec(50) },
      { personaId: DUENO_B, papel: 'propietario', porcentaje: dec(50) },
      { personaId: INQ, papel: 'inquilino', porcentaje: null },
    ],
    tramos: [
      { numero: 3, desde: d('2026-04-15'), hasta: d('2026-08-14'), importe: dec(1_043_387) },
      { numero: 4, desde: d('2026-08-15'), hasta: d('2026-12-14'), importe: null },
    ],
  };
}

/**
 * Lo que generó la generación del mes mientras el tramo 4 esperaba el IPC:
 * las partes del tramo 4, como parciales con el importe del tramo 3 (regla
 * 130). Como lo devuelve la base.
 */
function parcialesDe(periodos: string[], indice = 'IPC') {
  const c = aParaGenerar(contratoCompleto(indice) as never);
  const espera = new Map([
    [4, { importeProvisorio: 1_043_387, espera: 'el IPC de julio de 2026' }],
  ]);
  return periodos.flatMap((p) =>
    generarPeriodoConParciales(c, p, 21, espera)
      .conceptos.filter((k) => k.etapa === 'parcial')
      .map((k) => ({
        claveGeneracion: k.clave,
        sentido: k.sentido,
        importe: dec(k.importe),
        etapa: 'parcial',
        anuladoEn: null as Date | null,
      })),
  );
}

function makeTx(
  over: {
    tramos?: unknown[];
    tramo?: unknown;
    valores?: unknown[];
    grupos?: unknown[];
    actualizados?: number;
    etapas?: unknown[];
    config?: Record<string, unknown>;
    feriados?: { fecha: Date }[];
  } = {},
) {
  return {
    ...mocksDeHistorial(),
    alqConcepto: {
      findMany: vi.fn().mockResolvedValue(over.etapas ?? []),
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
    alqContrato: { findUniqueOrThrow: vi.fn().mockResolvedValue(contratoCompleto()) },
    feriado: { findMany: vi.fn().mockResolvedValue(over.feriados ?? []) },
    // El candado de la generación, que la confirmación comparte.
    $executeRaw: vi.fn(async (_s: TemplateStringsArray, ..._v: unknown[]) => 1),
    tenant: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ config: over.config ?? { ivaHonorariosPct: 21 } }),
    },
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
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
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
    const r = await new IndexacionesService(makeDb(makeTx({ tramos: [tramo(), t5] }))).bandeja(
      '2026-12-01',
    );
    expect(r.tramos.map((t) => t.numero)).toEqual([4]);
  });

  // Regla 106: un contrato tomado en curso con el tramo 2 cargado de memoria y
  // el 3 sin importe, pero el 4 (el vigente) sí: el 3 es historia.
  describe('regla 106: los tramos de antes de administrar un contrato en curso', () => {
    const tramos = [
      { numero: 1, desde: d('2025-04-15'), importe: null },
      { numero: 2, desde: d('2025-08-15'), importe: 900_000 },
      { numero: 3, desde: d('2025-12-15'), importe: null },
      { numero: 4, desde: d('2026-04-15'), importe: 1_043_387 },
      { numero: 5, desde: d('2026-08-15'), importe: null },
    ];
    const t3 = tramo({ numero: 3, desde: '2025-12-15', tramos });
    const t5 = tramo({ numero: 5, desde: '2026-08-15', tramos });

    it('no van a la bandeja «a indexar»: va el siguiente al vigente', async () => {
      const r = await new IndexacionesService(makeDb(makeTx({ tramos: [t3, t5] }))).bandeja(
        '2026-08-10',
      );
      expect(r.tramos.map((t) => t.numero)).toEqual([5]);
      expect(r.tramos[0]!.importeAnterior).toBe(1_043_387);
    });

    it('confirmarlos se rechaza', async () => {
      const tx = makeTx({ tramo: t3 });
      await expect(
        new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-3', { importe: null }),
      ).rejects.toThrow(/antes de que se administrara/);
      expect(tx.alqTramo.updateMany).not.toHaveBeenCalled();
    });
  });

  // Regla 7.
  it('sin el IPC del mes: pendiente de índice, y nombra el que falta', async () => {
    const r = await new IndexacionesService(makeDb(makeTx({ valores: [IPC[0]] }))).bandeja(
      '2026-08-20',
    );
    expect(r.tramos[0]).toMatchObject({
      estado: 'pendiente_indice',
      falta: ['el IPC de julio de 2026'],
      importePropuesto: null,
      // Ya empezó, pero sin índice no es «vencida»: espera el índice (regla 7).
      // Antes decía `true` y el Dashboard la contaba entre las vencidas.
      vencida: false,
    });
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
      const consultas =
        tx.alqTramo.findMany.mock.calls.length +
        tx.indiceValor.findMany.mock.calls.length +
        tx.indiceValor.groupBy.mock.calls.length;
      expect(consultas).toBe(3);
    }
  });

  // Regla 8: el estado de cada índice viaja con la bandeja.
  it('avisa si el ICL lleva más de 3 días sin valores nuevos', async () => {
    const grupos = [
      {
        indice: 'ICL',
        _max: { fecha: d('2026-10-16'), createdAt: new Date('2026-10-05T12:00:00Z') },
      },
      {
        indice: 'IPC',
        _max: { fecha: d('2026-08-01'), createdAt: new Date('2026-09-14T12:00:00Z') },
      },
    ];
    const r = await new IndexacionesService(makeDb(makeTx({ grupos }))).bandeja('2026-10-09');
    expect(r.indices[0]).toMatchObject({ indice: 'ICL', ultimaFecha: '2026-10-16' });
    expect(r.indices[0]!.alerta).toMatch(/no trae valores nuevos/);
    expect(r.indices[1]).toEqual({ indice: 'IPC', ultimaFecha: '2026-08-01', alerta: null });
  });
});

describe('IndexacionesService.confirmar (regla 6)', () => {
  // Revisión de seguridad del 15/10/2026: el mismo candado que «Generar el
  // período», antes de leer el tramo; si no, una generación en el medio deja
  // una parcial que no recibe su final (regla 131).
  it('toma el candado de la generación antes de leer el tramo', async () => {
    const tx = makeTx();
    await new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe: null });
    const [sql, ...valores] = tx.$executeRaw.mock.calls[0]!;
    expect((sql as TemplateStringsArray).join('?')).toMatch(
      /pg_advisory_xact_lock\(hashtext\(\?\)\)/,
    );
    expect(valores).toEqual(['t1:alq_generacion']);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]!).toBeLessThan(
      tx.alqTramo.findUnique.mock.invocationCallOrder[0]!,
    );
  });

  it('guarda el importe que calcula la API, con los índices usados y quién confirmó', async () => {
    const tx = makeTx();
    const r = await new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', {
      importe: null,
    });
    expect(r).toEqual({ tramoId: 'tramo-4', numero: 4, importe: 1_137_518, diferencias: null });
    // Sin parciales de ese tramo, no se genera nada más.
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
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
    await expect(
      new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe: 1_200_000 }),
    ).rejects.toThrow(/sale del índice: \$ 1\.137\.518/);
    expect(tx.alqTramo.updateMany).not.toHaveBeenCalled();
  });

  // Regla 7: sin índice no hay nada que confirmar.
  it('sin el índice publicado no se puede confirmar', async () => {
    await expect(
      new IndexacionesService(makeDb(makeTx({ valores: [] }))).confirmar(CTX, 'tramo-4', {
        importe: null,
      }),
    ).rejects.toThrow(/falta el IPC de marzo de 2026 y el IPC de julio de 2026/);
  });

  it('Casa Propia: el importe va a mano y es obligatorio', async () => {
    const ccp = tramo({ indice: 'CCP' });
    const svc = new IndexacionesService(makeDb(makeTx({ tramo: ccp })));
    await expect(svc.confirmar(CTX, 'tramo-4', { importe: null })).rejects.toThrow(
      /cargá el importe/,
    );
    const tx = makeTx({ tramo: ccp });
    await new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe: 1_150_000.4 });
    expect(tx.alqTramo.updateMany.mock.calls[0]![0].data).toMatchObject({
      importe: 1_150_000,
      importePropuesto: null,
      indiceBase: null,
    });
  });

  it('no se saltea un tramo: el anterior tiene que estar indexado', async () => {
    const t5 = tramo({ numero: 5, desde: '2026-12-15' });
    await expect(
      new IndexacionesService(makeDb(makeTx({ tramo: t5 }))).confirmar(CTX, 'tramo-5', {
        importe: null,
      }),
    ).rejects.toThrow(/Primero hay que indexar el tramo 4/);
  });

  it('un tramo ya indexado, o que otra persona confirmó recién, no se pisa', async () => {
    await expect(
      new IndexacionesService(makeDb(makeTx({ tramo: tramo({ importe: 1 }) }))).confirmar(
        CTX,
        'tramo-4',
        { importe: null },
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      new IndexacionesService(makeDb(makeTx({ actualizados: 0 }))).confirmar(CTX, 'tramo-4', {
        importe: null,
      }),
    ).rejects.toThrow(/Otra persona/);
  });

  it('un contrato que no está vigente no se indexa', async () => {
    await expect(
      new IndexacionesService(makeDb(makeTx({ tramo: tramo({ estado: 'borrador' }) }))).confirmar(
        CTX,
        'tramo-4',
        { importe: null },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('IndexacionesService: liquidación final (reglas 131 a 137)', () => {
  type Creado = Record<string, unknown> & { claveGeneracion: string; importe: number };
  const creados = (tx: ReturnType<typeof makeTx>) =>
    tx.alqConcepto.createMany.mock.calls[0]![0].data as Creado[];
  const confirmar = (tx: ReturnType<typeof makeTx>, importe: number | null = null) =>
    new IndexacionesService(makeDb(tx)).confirmar(CTX, 'tramo-4', { importe }, '2026-10-15');

  it('regla 131: al confirmar, cada concepto de cada mes cobrado como parcial recibe su diferencia, en ese mes', async () => {
    const tx = makeTx({ etapas: parcialesDe(['2026-08', '2026-09']) });
    const r = await confirmar(tx);
    expect(tx.alqConcepto.findMany.mock.calls[0]![0].where).toEqual({
      contratoId: 'c5',
      tramoNumero: 4,
      etapa: { not: null },
    });
    const ks = creados(tx);
    // Seis por mes: el alquiler y los gastos del inquilino; el alquiler y los honorarios de cada dueño.
    expect(ks).toHaveLength(12);
    expect(ks.every((k) => k.etapa === 'final' && k.tramoNumero === 4)).toBe(true);
    expect(new Set(ks.map((k) => k.periodo))).toEqual(new Set(['2026-08', '2026-09']));
    expect(
      ks.find((k) => k.periodo === '2026-09' && k.tipo === 'alquiler' && k.sentido === 'a_cobrar'),
    ).toMatchObject({
      personaId: INQ,
      importe: 94_131, // 1.137.518 − 1.043.387
      descripcion: 'Alquiler septiembre 2026 — liquidación final (diferencia por IPC)',
      // Regla 133: el jueves 15/10 + 5 días = martes 20/10.
      vencimiento: d('2026-10-20'),
      creadoPorId: 'u1',
    });
    expect(r.diferencias).toEqual({
      moneda: 'ARS',
      periodos: ['2026-08', '2026-09'],
      inquilino: expect.any(Number),
      propietarios: expect.any(Number),
      vencimiento: '2026-10-20',
      conceptos: 12,
    });
    expect(r.diferencias!.inquilino).toBeGreaterThan(0);
    // Y queda en el historial del contrato.
    expect(tx.alqEvento.createMany.mock.calls.at(-1)![0].data[0].resumen).toMatch(
      /^Generó la liquidación final de agosto de 2026 y septiembre de 2026: inquilino \$/,
    );
  });

  it('regla 132: parcial + final = definitivo al centavo, con dos dueños al 50%, honorarios y gastos', async () => {
    const etapas = parcialesDe(['2026-08', '2026-09']);
    const tx = makeTx({ etapas });
    await confirmar(tx);
    const suma = new Map<string, number>();
    for (const e of etapas) suma.set(e.claveGeneracion, Math.round(Number(e.importe) * 100));
    for (const k of creados(tx)) {
      const base = claveParcialDeFinal(k.claveGeneracion)!;
      suma.set(base, suma.get(base)! + Math.round(k.importe * 100));
    }
    const definitivo = aParaGenerar(contratoCompleto() as never);
    definitivo.tramos = definitivo.tramos.map((t) =>
      t.numero === 4 ? { ...t, importe: 1_137_518 } : t,
    );
    const esperado = ['2026-08', '2026-09'].flatMap((p) =>
      generarPeriodo(definitivo, p, 21).conceptos.filter((k) => suma.has(k.clave)),
    );
    expect(esperado).toHaveLength(12);
    for (const k of esperado)
      expect([k.clave, suma.get(k.clave)! / 100]).toEqual([k.clave, k.importe]);
  });

  it('regla 131: el importe cargado a mano al confirmar (Casa Propia) es el definitivo de la final', async () => {
    const tx = makeTx({ etapas: parcialesDe(['2026-09'], 'CCP'), tramo: tramo({ indice: 'CCP' }) });
    tx.alqContrato.findUniqueOrThrow.mockResolvedValue(contratoCompleto('CCP'));
    const r = await confirmar(tx, 1_000_000);
    // Menos que el anterior: el inquilino tiene a favor y los dueños devuelven (regla 134).
    const alquiler = creados(tx).find(
      (k) => k.personaId === INQ && k.claveGeneracion.includes('|alquiler|'),
    )!;
    expect(alquiler).toMatchObject({
      tipo: 'otro',
      sentido: 'a_pagar',
      importe: 43_387,
      descripcion:
        'Alquiler septiembre 2026 — liquidación final (diferencia por Casa Propia, a su favor)',
    });
    expect(r.diferencias!.inquilino).toBeLessThan(0);
    expect(r.diferencias!.propietarios).toBeLessThan(0);
  });

  it('regla 133: los días para pagar la diferencia salen de la configuración, corridos al lunes', async () => {
    const tx = makeTx({
      etapas: parcialesDe(['2026-09']),
      config: { ivaHonorariosPct: 21, diasDiferenciaFinal: 2 },
    });
    const r = await confirmar(tx);
    // Jueves 15/10 + 2 = sábado 17/10 → lunes 19/10.
    expect(r.diferencias!.vencimiento).toBe('2026-10-19');
    expect(creados(tx).every((k) => +(k.vencimiento as Date) === +d('2026-10-19'))).toBe(true);
  });

  it('regla 133: el vencimiento también se corre por feriado (regla 100)', async () => {
    // Jueves 15/10 + 5 = martes 20/10; si el 20 y el 21 fueran feriados, el jueves 22.
    const tx = makeTx({
      etapas: parcialesDe(['2026-09']),
      feriados: [{ fecha: d('2026-10-20') }, { fecha: d('2026-10-21') }],
    });
    const r = await confirmar(tx);
    expect(r.diferencias!.vencimiento).toBe('2026-10-22');
  });

  it('regla 135: una parcial anulada no recibe final', async () => {
    const etapas = parcialesDe(['2026-09']).map((e) =>
      e.sentido === 'a_cobrar' && e.claveGeneracion.includes('|alquiler|')
        ? { ...e, anuladoEn: new Date() }
        : e,
    );
    const tx = makeTx({ etapas });
    await confirmar(tx);
    expect(creados(tx)).toHaveLength(5);
    expect(creados(tx).some((k) => k.personaId === INQ && k.tipo === 'alquiler')).toBe(false);
  });

  it('regla 137: la vista previa dice lo mismo que la confirmación, sin confirmar ni generar nada', async () => {
    const etapas = parcialesDe(['2026-08', '2026-09']);
    const previa = makeTx({ etapas });
    const vista = await new IndexacionesService(makeDb(previa)).previsualizar(
      CTX,
      'tramo-4',
      { importe: null },
      '2026-10-15',
    );
    expect(previa.alqTramo.updateMany).not.toHaveBeenCalled();
    expect(previa.alqConcepto.createMany).not.toHaveBeenCalled();
    expect(previa.alqEvento.createMany).not.toHaveBeenCalled();
    const r = await confirmar(makeTx({ etapas }));
    expect(vista).toEqual({ diferencias: r.diferencias });
    // Un tramo sin parciales no tiene vista previa.
    expect(
      await new IndexacionesService(makeDb(makeTx())).previsualizar(CTX, 'tramo-4', {
        importe: null,
      }),
    ).toEqual({ diferencias: null });
  });

  it('regla 137: la vista previa valida como la confirmación (sin índice, no hay importe)', async () => {
    const tx = makeTx({ valores: [], etapas: parcialesDe(['2026-09']) });
    await expect(
      new IndexacionesService(makeDb(tx)).previsualizar(CTX, 'tramo-4', { importe: null }),
    ).rejects.toThrow(/falta el IPC/);
  });

  it('regla 131: las mismas consultas con un mes cobrado como parcial y con cinco', async () => {
    const cuantas = async (periodos: string[]) => {
      const tx = makeTx({ etapas: parcialesDe(periodos) });
      await confirmar(tx);
      expect(creados(tx).length).toBe(6 * periodos.length);
      return Object.values(tx)
        .flatMap((m) => Object.values(m as Record<string, { mock?: { calls: unknown[] } }>))
        .reduce((n, f) => n + (f.mock?.calls.length ?? 0), 0);
    };
    expect(await cuantas(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])).toBe(
      await cuantas(['2026-09']),
    );
  });
});
