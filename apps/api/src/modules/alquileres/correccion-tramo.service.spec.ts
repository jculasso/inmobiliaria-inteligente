import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  claveParcialDeFinal,
  diferenciasDeLiquidacionFinal,
  generarPeriodo,
  generarPeriodoConParciales,
  type ContratoParaGenerar,
} from '@vacker/domain';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { CorreccionTramoService, MARCA_CORREGIDO } from './correccion-tramo.service';
import { IndexacionesService } from './indexaciones.service';
import { mocksDeHistorial } from './historial.testing';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
const INQ = '11111111-1111-4111-8111-111111111111';
const DUENO = '22222222-2222-4222-8222-222222222222';

/*
 * El contrato #5 de Gexion (IPC, arranca el 15/08/2025): el tramo 4 va del
 * 15/08/2026 al 14/12/2026 a 1.137.518. Después de indexar, las partes
 * negocian 1.000.000 (el caso de Florencia, Vacker, 15/10/2026).
 */
const TRAMOS = [
  { id: 'tr3', numero: 3, desde: d('2026-04-15'), hasta: d('2026-08-14'), importe: dec(1_043_387) },
  { id: 'tr4', numero: 4, desde: d('2026-08-15'), hasta: d('2026-12-14'), importe: dec(1_137_518) },
  { id: 'tr5', numero: 5, desde: d('2026-12-15'), hasta: d('2027-04-14'), importe: null },
];

function contrato(over: Record<string, unknown> = {}) {
  return {
    id: 'c5',
    codigo: 'VAC-0005',
    estado: 'vigente',
    moneda: 'ARS',
    inicio: d('2025-08-15'),
    fin: d('2027-08-14'),
    administradoDesde: null,
    rescindidoEl: null,
    diaVencimiento: 5,
    diaPagoPropietario: 10,
    honorariosPct: dec(8),
    gastosAdmPct: dec(2),
    ivaPct: dec(0),
    partes: [
      { personaId: DUENO, papel: 'propietario', porcentaje: dec(100) },
      { personaId: INQ, papel: 'inquilino', porcentaje: null },
    ],
    tramos: TRAMOS,
    ...over,
  };
}

/** El mismo contrato para el dominio, con números: de acá salen las claves reales. */
const paraGenerar: ContratoParaGenerar = {
  id: 'c5',
  moneda: 'ARS',
  inicio: '2025-08-15',
  fin: '2027-08-14',
  rescindidoEl: null,
  diaVencimiento: 5,
  diaPagoPropietario: 10,
  honorariosPct: 8,
  gastosAdmPct: 2,
  ivaPct: 0,
  tramos: [
    { numero: 3, desde: '2026-04-15', hasta: '2026-08-14', importe: 1_043_387 },
    { numero: 4, desde: '2026-08-15', hasta: '2026-12-14', importe: 1_137_518 },
    { numero: 5, desde: '2026-12-15', hasta: '2027-04-14', importe: null },
  ],
  propietarios: [{ personaId: DUENO, porcentaje: 100 }],
  inquilinos: [{ personaId: INQ }],
};

/**
 * Los conceptos ya generados de unos meses, como los devuelve Prisma. `cobrado`
 * y `liquidado` marcan el alquiler del inquilino o del propietario de ese mes.
 */
function generados(estados: Record<string, 'generado' | 'cobrado' | 'liquidado'>) {
  return Object.entries(estados).flatMap(([periodo, estado]) =>
    generarPeriodo(paraGenerar, periodo, 21).conceptos.map((k, i) => ({
      id: `${periodo}-${i}`,
      periodo,
      claveGeneracion: k.clave,
      anuladoEn: null,
      liquidacionId:
        estado === 'liquidado' && k.tipo === 'alquiler' && k.sentido === 'a_pagar' ? 'liq1' : null,
      _count: {
        imputaciones:
          estado === 'cobrado' && k.tipo === 'alquiler' && k.sentido === 'a_cobrar' ? 1 : 0,
      },
    })),
  );
}

function makeTx(
  over: { contrato?: unknown; conceptos?: unknown[]; anulados?: number; tramos?: number } = {},
) {
  return {
    ...mocksDeHistorial(),
    alqContrato: { findUnique: vi.fn().mockResolvedValue(over.contrato ?? contrato()) },
    alqConcepto: {
      findMany: vi.fn().mockResolvedValue(over.conceptos ?? []),
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
    alqTramo: { updateMany: vi.fn().mockResolvedValue({ count: over.tramos ?? 1 }) },
    tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ config: { ivaHonorariosPct: 21 } }) },
    feriado: { findMany: vi.fn().mockResolvedValue([]) },
    // Tagged template: (strings, ...valores). Devuelve cuántas filas anuló.
    $executeRaw: vi.fn(async (_s: TemplateStringsArray, ..._v: unknown[]) => over.anulados ?? -1),
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
}

type Fila = {
  tipo: string;
  sentido: string;
  importe: number;
  periodo: string;
  claveGeneracion: string;
};
const creados = (tx: ReturnType<typeof makeTx>) =>
  (tx.alqConcepto.createMany.mock.calls[0]?.[0] as { data: Fila[] } | undefined)?.data ?? [];

/** Los ids que la anulación recibió, sacados de los valores del SQL. */
const idsAnulados = (tx: ReturnType<typeof makeTx>) =>
  JSON.stringify(tx.$executeRaw.mock.calls[0]?.slice(1) ?? []);

const DTO = { importe: 1_000_000, desde: '2026-10', motivo: 'Lo negociaron las partes' };

describe('CorreccionTramoService.preparar (regla 108)', () => {
  it('cada mes del tramo con su estado, y se propone el primero sin nada cobrado ni liquidado', async () => {
    const tx = makeTx({
      conceptos: generados({ '2026-08': 'cobrado', '2026-09': 'liquidado', '2026-10': 'generado' }),
    });
    const r = await new CorreccionTramoService(makeDb(tx)).preparar('c5', 4);
    expect(r).toEqual({
      numero: 4,
      desde: '2026-08-15',
      hasta: '2026-12-14',
      importe: 1_137_518,
      meses: [
        { periodo: '2026-08', estado: 'cobrado' },
        { periodo: '2026-09', estado: 'liquidado' },
        { periodo: '2026-10', estado: 'generado' },
        { periodo: '2026-11', estado: 'sin_generar' },
        { periodo: '2026-12', estado: 'sin_generar' },
      ],
      desdeSugerido: '2026-10',
    });
  });

  it('en un mes con cambio de tramo, lo cobrado del otro tramo no cuenta', async () => {
    // Agosto: del 1 al 14 es del tramo 3 (cobrado); del 15 al 31, del 4 (sin cobrar).
    const agosto = generados({ '2026-08': 'generado' }).map((k) =>
      k.claveGeneracion.includes('|2026-08-01|') ? { ...k, _count: { imputaciones: 1 } } : k,
    );
    const r = await new CorreccionTramoService(makeDb(makeTx({ conceptos: agosto }))).preparar(
      'c5',
      4,
    );
    expect(r.meses[0]).toEqual({ periodo: '2026-08', estado: 'generado' });
    expect(r.desdeSugerido).toBe('2026-08');
  });

  it('un contrato tomado en curso lista los meses desde que se administra', async () => {
    const tx = makeTx({ contrato: contrato({ administradoDesde: d('2026-10-10') }) });
    const r = await new CorreccionTramoService(makeDb(tx)).preparar('c5', 4);
    expect(r.meses.map((m) => m.periodo)).toEqual(['2026-10', '2026-11', '2026-12']);
  });
});

describe('CorreccionTramoService.corregir (reglas 108 a 111)', () => {
  const conceptos = generados({
    '2026-08': 'cobrado',
    '2026-09': 'cobrado',
    '2026-10': 'generado',
    '2026-11': 'generado',
  });
  const aCorregir = conceptos.filter((k) => k.periodo >= '2026-10');

  it('regla 109: anula con el motivo lo generado sin cobrar y lo vuelve a generar con el importe nuevo', async () => {
    const tx = makeTx({ conceptos, anulados: aCorregir.length });
    const r = await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, DTO);
    expect(r).toEqual({
      numero: 4,
      importeAnterior: 1_137_518,
      importe: 1_000_000,
      desde: '2026-10',
      regenerados: ['2026-10', '2026-11'],
      quedan: [],
    });
    // Una sola anulación, con los ocho conceptos de octubre y noviembre, la marca y el motivo.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const valores = idsAnulados(tx);
    for (const k of aCorregir) expect(valores).toContain(k.id);
    for (const k of conceptos.filter((x) => x.periodo < '2026-10'))
      expect(valores).not.toContain(`"${k.id}"`);
    expect(valores).toContain(MARCA_CORREGIDO);
    expect(valores).toContain('corrección del importe del tramo 4: Lo negociaron las partes');
    // Lo regenerado: el mismo mes, la misma clave, el importe nuevo y lo que deriva de él.
    expect(creados(tx).map((x) => [x.periodo, x.tipo, x.sentido, x.importe])).toEqual([
      ['2026-10', 'alquiler', 'a_cobrar', 1_000_000],
      ['2026-10', 'gastos_adm', 'a_cobrar', 24_200],
      ['2026-10', 'alquiler', 'a_pagar', 1_000_000],
      ['2026-10', 'honorarios', 'a_cobrar', 96_800],
      ['2026-11', 'alquiler', 'a_cobrar', 1_000_000],
      ['2026-11', 'gastos_adm', 'a_cobrar', 24_200],
      ['2026-11', 'alquiler', 'a_pagar', 1_000_000],
      ['2026-11', 'honorarios', 'a_cobrar', 96_800],
    ]);
    expect(creados(tx).map((x) => x.claveGeneracion)).toEqual(
      aCorregir.map((k) => k.claveGeneracion),
    );
    expect(tx.alqConcepto.createMany.mock.calls[0]![0]).toMatchObject({ skipDuplicates: true });
  });

  it('regla 109: lo cobrado dentro del rango queda como está, y el resultado lo dice', async () => {
    const tx = makeTx({ conceptos, anulados: aCorregir.length });
    const r = await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, {
      ...DTO,
      desde: '2026-09',
    });
    expect(r.regenerados).toEqual(['2026-10', '2026-11']);
    expect(r.quedan).toEqual([{ periodo: '2026-09', estado: 'cobrado' }]);
    expect(creados(tx).some((x) => x.periodo === '2026-09')).toBe(false);
    expect(idsAnulados(tx)).not.toContain('"2026-09-0"');
  });

  it('regla 109: un mes todavía sin generar no se crea ahora: sale con el importe nuevo al generarlo', async () => {
    const tx = makeTx({ conceptos, anulados: aCorregir.length });
    await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, DTO);
    expect(creados(tx).some((x) => x.periodo === '2026-12')).toBe(false);
  });

  it('regla 109: en un mes con cambio de tramo se regenera solo la parte del tramo corregido', async () => {
    const agosto = generados({ '2026-08': 'generado' });
    const delTramo4 = agosto.filter((k) => k.claveGeneracion.includes('|2026-08-15|'));
    const tx = makeTx({ conceptos: agosto, anulados: delTramo4.length });
    await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, {
      ...DTO,
      desde: '2026-08',
    });
    expect(creados(tx).every((x) => x.claveGeneracion.includes('|2026-08-15|'))).toBe(true);
    // Del 15 al 31 de agosto: 1.000.000 × 17/31.
    expect(creados(tx).find((x) => x.tipo === 'alquiler')!.importe).toBe(548_387.1);
    expect(idsAnulados(tx)).not.toContain(
      `"${agosto.find((k) => k.claveGeneracion.includes('|2026-08-01|'))!.id}"`,
    );
  });

  it('regla 110: el tramo guarda el importe nuevo y el historial dice antes, después, quién y por qué', async () => {
    const tx = makeTx({ conceptos, anulados: aCorregir.length });
    await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, DTO);
    expect(tx.alqTramo.updateMany).toHaveBeenCalledWith({
      where: { id: 'tr4', importe: 1_137_518 },
      data: { importe: 1_000_000 },
    });
    const evento = tx.alqEvento.createMany.mock.calls[0]![0].data[0];
    expect(evento).toMatchObject({
      entidad: 'tramo',
      entidadId: 'tr4',
      contratoId: 'c5',
      accion: 'edicion',
      usuarioId: 'u1',
      usuarioNombre: 'Lucía Operadora',
      detalle: {
        antes: 1_137_518,
        despues: 1_000_000,
        desde: '2026-10',
        motivo: 'Lo negociaron las partes',
      },
    });
    expect(evento.resumen).toMatch(/\$ 1\.137\.518,00 → \$ 1\.000\.000,00 desde octubre de 2026/);
  });

  it('regla 110: la indexación siguiente parte del importe corregido', async () => {
    // Lo que quedó en el tramo 4 es la base del 5 (regla 5): 1.000.000 × IPC nov ÷ IPC jul.
    const t5 = {
      id: 'tr5',
      numero: 5,
      desde: d('2026-12-15'),
      hasta: d('2027-04-14'),
      importe: null,
      contrato: {
        id: 'c5',
        codigo: 'VAC-0005',
        estado: 'vigente',
        ajuste: 'indexado',
        indice: 'IPC',
        propiedad: { direccion: 'Calle 1', unidad: null },
        partes: [],
        tramos: [
          { numero: 4, desde: d('2026-08-15'), importe: dec(1_000_000) },
          { numero: 5, desde: d('2026-12-15'), importe: null },
        ],
      },
    };
    const tx = {
      alqTramo: { findMany: vi.fn().mockResolvedValue([t5]) },
      indiceValor: {
        findMany: vi.fn().mockResolvedValue([
          { indice: 'IPC', fecha: d('2026-07-01'), valor: 100 },
          { indice: 'IPC', fecha: d('2026-11-01'), valor: 110 },
        ]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };
    const r = await new IndexacionesService(makeDb(tx)).bandeja('2026-12-01');
    expect(r.tramos[0]).toMatchObject({ importeAnterior: 1_000_000, importePropuesto: 1_100_000 });
  });

  it('regla 111: las mismas consultas corrija un mes o tres', async () => {
    const contar = async (estados: Record<string, 'generado'>, desde: string) => {
      const cs = generados(estados);
      const tx = makeTx({ conceptos: cs, anulados: cs.length });
      await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, { ...DTO, desde });
      return [
        tx.alqContrato.findUnique,
        tx.alqConcepto.findMany,
        tx.$executeRaw,
        tx.alqTramo.updateMany,
        tx.tenant.findUniqueOrThrow,
        tx.feriado.findMany,
        tx.alqConcepto.createMany,
        tx.usuario.findUnique,
        tx.alqEvento.createMany,
      ].reduce((s, f) => s + f.mock.calls.length, 0);
    };
    // Diez: la décima busca las parciales del tramo para la regla 135.
    expect(await contar({ '2026-11': 'generado' }, '2026-11')).toBe(10);
    expect(
      await contar(
        { '2026-09': 'generado', '2026-10': 'generado', '2026-11': 'generado' },
        '2026-09',
      ),
    ).toBe(10);
  });

  describe('lo que se rechaza', () => {
    const corregir = (tx: ReturnType<typeof makeTx>, dto = DTO, numero = 4) =>
      new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', numero, dto);

    it('un contrato que no está vigente', async () => {
      await expect(
        corregir(makeTx({ contrato: contrato({ estado: 'finalizado' }) })),
      ).rejects.toThrow(BadRequestException);
    });

    it('un tramo sin importe todavía: se confirma desde «A indexar»', async () => {
      await expect(corregir(makeTx(), DTO, 5)).rejects.toThrow(/A indexar/);
    });

    it('el mismo importe que ya tiene', async () => {
      await expect(corregir(makeTx(), { ...DTO, importe: 1_137_518 })).rejects.toThrow(
        /ya tiene ese importe/,
      );
    });

    it('un mes fuera del tramo', async () => {
      await expect(corregir(makeTx(), { ...DTO, desde: '2027-01' })).rejects.toThrow(
        /no es un mes del tramo 4/,
      );
    });

    it('si alguien cobró algo mientras tanto, no se anula ni se corrige nada', async () => {
      const tx = makeTx({ conceptos, anulados: aCorregir.length - 1 });
      await expect(corregir(tx)).rejects.toThrow(ConflictException);
      expect(tx.alqTramo.updateMany).not.toHaveBeenCalled();
      expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
    });

    it('si otra persona cambió el tramo mientras tanto, no se pisa', async () => {
      const tx = makeTx({ conceptos, anulados: aCorregir.length, tramos: 0 });
      await expect(corregir(tx)).rejects.toThrow(ConflictException);
      expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
    });
  });

  // Regla 135: septiembre se cobró como parcial (el tramo esperaba el IPC),
  // se confirmó a 1.137.518 con su final, y el inquilino pagó la parcial.
  // Después las partes negocian 1.000.000 desde septiembre.
  describe('liquidación parcial y final (regla 135)', () => {
    const conEtapa = (importe4: number | null) => ({
      ...paraGenerar,
      tramos: paraGenerar.tramos.map((t) => (t.numero === 4 ? { ...t, importe: importe4 } : t)),
    });
    const parcial = generarPeriodoConParciales(
      conEtapa(null),
      '2026-09',
      21,
      new Map([[4, { importeProvisorio: 1_043_387, espera: 'el IPC de julio de 2026' }]]),
    ).conceptos;
    const final = diferenciasDeLiquidacionFinal({
      contrato: conEtapa(1_137_518),
      tramo: 4,
      ivaInmobiliariaPct: 21,
      existentes: parcial.map((k) => ({
        clave: k.clave,
        sentido: k.sentido,
        importe: k.importe,
        etapa: 'parcial' as const,
        anulado: false,
      })),
      vencimiento: '2026-10-20',
      indice: 'IPC',
    });
    const filas = [
      ...parcial.map((k, i) => ({ k, etapa: 'parcial', id: `p${i}` })),
      ...final.map((k, i) => ({ k, etapa: 'final', id: `f${i}` })),
    ].map(({ k, etapa, id }) => ({
      id,
      periodo: k.periodo,
      claveGeneracion: k.clave,
      sentido: k.sentido,
      importe: dec(k.importe),
      etapa,
      anuladoEn: null,
      liquidacionId: null,
      _count: {
        imputaciones:
          etapa === 'parcial' && k.tipo === 'alquiler' && k.sentido === 'a_cobrar' ? 1 : 0,
      },
    }));

    it('regla 135: el mes cobrado como parcial queda como estaba y recibe otra final con la diferencia', async () => {
      const tx = makeTx({ conceptos: filas });
      Object.assign(tx.alqContrato, {
        findUniqueOrThrow: vi.fn().mockResolvedValue(contrato({ indice: 'IPC' })),
      });
      const r = await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, {
        ...DTO,
        importe: 1_000_000,
        desde: '2026-09',
      });
      expect(r.quedan.map((m) => m.periodo)).toEqual(['2026-09']);
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      const creadas = tx.alqConcepto.createMany.mock.calls[0]![0].data as {
        claveGeneracion: string;
        tipo: string;
        sentido: string;
        importe: number;
        personaId: string;
        etapa: string;
      }[];
      const alquiler = creadas.find(
        (k) => k.personaId === INQ && k.claveGeneracion.includes('|alquiler|a_cobrar|'),
      )!;
      // 1.000.000 − (1.043.387 + 94.131): se le devuelven 137.518, en otra final.
      expect(alquiler).toMatchObject({
        tipo: 'otro',
        sentido: 'a_pagar',
        importe: 137_518,
        etapa: 'final',
      });
      expect(alquiler.claveGeneracion).toContain('~final2|');
      expect(claveParcialDeFinal(alquiler.claveGeneracion)).toBe(
        parcial.find((k) => k.tipo === 'alquiler' && k.sentido === 'a_cobrar')!.clave,
      );
    });

    it('regla 135: los meses de antes del elegido no reciben otra final', async () => {
      const tx = makeTx({ conceptos: filas });
      Object.assign(tx.alqContrato, {
        findUniqueOrThrow: vi.fn().mockResolvedValue(contrato({ indice: 'IPC' })),
      });
      await new CorreccionTramoService(makeDb(tx)).corregir(CTX, 'c5', 4, {
        ...DTO,
        importe: 1_000_000,
        desde: '2026-10',
      });
      expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
    });
  });
});
