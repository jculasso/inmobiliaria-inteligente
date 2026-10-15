import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ConceptoSueltoInputSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { ConceptosService } from './conceptos.service';
import { mocksDeHistorial } from './historial.testing';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
const INQ = '11111111-1111-4111-8111-111111111111';
const DUENO = '22222222-2222-4222-8222-222222222222';
const OTRO_DUENO = '33333333-3333-4333-8333-333333333333';

/** El contrato #5 de Gexion como lo devuelve Prisma: tramo 4 indexado, el 5 no. */
function contrato(over: Record<string, unknown> = {}) {
  return {
    id: 'c5',
    codigo: '5',
    estado: 'vigente',
    moneda: 'ARS',
    inicio: d('2025-08-15'),
    fin: d('2027-08-14'),
    rescindidoEl: null,
    diaVencimiento: 5,
    diaPagoPropietario: 10,
    honorariosPct: dec(8),
    gastosAdmPct: dec(2),
    ivaPct: dec(0),
    propiedad: { direccion: 'Calle 1' },
    partes: [
      { personaId: DUENO, papel: 'propietario', porcentaje: dec(100) },
      { personaId: INQ, papel: 'inquilino', porcentaje: null },
    ],
    tramos: [
      { numero: 4, desde: d('2026-08-15'), hasta: d('2026-12-14'), importe: dec(1_137_518) },
      { numero: 5, desde: d('2026-12-15'), hasta: d('2027-04-14'), importe: null },
    ],
    ...over,
  };
}

interface Fila {
  id?: string;
  personaId: string;
  tipo: string;
  sentido: string;
  importe: number;
  claveGeneracion?: string;
  origenId?: string;
  adelantadoPorInmobiliaria?: boolean;
  [k: string]: unknown;
}

function makeTx(
  over: {
    contratos?: unknown[];
    contrato?: unknown;
    existentes?: number;
    concepto?: unknown;
    anulados?: number;
    feriados?: { fecha: Date }[];
    valores?: unknown[];
  } = {},
) {
  return {
    ...mocksDeHistorial(),
    indiceValor: { findMany: vi.fn().mockResolvedValue(over.valores ?? []) },
    tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ config: { ivaHonorariosPct: 21 } }) },
    feriado: { findMany: vi.fn().mockResolvedValue(over.feriados ?? []) },
    alqContrato: {
      findMany: vi.fn().mockResolvedValue(over.contratos ?? [contrato()]),
      findUnique: vi
        .fn()
        .mockResolvedValue(over.contrato === undefined ? contrato() : over.contrato),
    },
    alqConcepto: {
      // `skipDuplicates`: lo que ya existe no cuenta como creado.
      createMany: vi.fn(async ({ data }: { data: Fila[] }) => ({
        count: data.length - (over.existentes ?? 0),
      })),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi
        .fn()
        .mockResolvedValue(
          over.concepto === undefined
            ? { anuladoEn: null, liquidacionId: null, _count: { imputaciones: 0 } }
            : over.concepto,
        ),
      updateMany: vi.fn().mockResolvedValue({ count: over.anulados ?? 1 }),
    },
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
}

const datos = (tx: ReturnType<typeof makeTx>) => tx.alqConcepto.createMany.mock.calls[0]![0].data;

describe('ConceptosService.generar (reglas 9 a 13)', () => {
  it('noviembre de 2026 del contrato #5, como en Gexion, con el tenant y la clave', async () => {
    const tx = makeTx();
    const r = await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
    expect(r).toEqual({
      periodo: '2026-11',
      contratos: 1,
      creados: 4,
      existentes: 0,
      sinIndexar: [],
      parciales: [],
    });
    expect(datos(tx).map((x) => [x.tipo, x.sentido, x.personaId, x.importe])).toEqual([
      ['alquiler', 'a_cobrar', INQ, 1_137_518],
      ['gastos_adm', 'a_cobrar', INQ, 27_527.94],
      ['alquiler', 'a_pagar', DUENO, 1_137_518],
      ['honorarios', 'a_cobrar', DUENO, 110_111.74],
    ]);
    expect(datos(tx)[0]).toMatchObject({
      tenantId: 't1',
      contratoId: 'c5',
      periodo: '2026-11',
      vencimiento: d('2026-11-05'),
    });
    expect(datos(tx)[0]!.claveGeneracion).toMatch(/^alq\|c5\|2026-11\|/);
  });

  // Regla 10: la base saltea lo que ya existe.
  it('generar de nuevo no duplica: pide saltear duplicados y lo informa', async () => {
    const tx = makeTx({ existentes: 4 });
    const r = await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
    expect(tx.alqConcepto.createMany.mock.calls[0]![0]).toMatchObject({ skipDuplicates: true });
    expect(r).toMatchObject({ creados: 0, existentes: 4 });
  });

  // Regla 11.
  it('la parte sin indexar no se genera y vuelve con el contrato', async () => {
    const r = await new ConceptosService(makeDb(makeTx())).generar(CTX, '2026-12');
    expect(r.sinIndexar).toEqual([
      {
        contratoId: 'c5',
        codigo: '5',
        direccion: 'Calle 1',
        tramo: 5,
        desde: '2026-12-15',
        hasta: '2026-12-31',
      },
    ]);
    expect(r.creados).toBe(4);
  });

  it('pide a la base solo los contratos del mes, sin borradores', async () => {
    const tx = makeTx();
    await new ConceptosService(makeDb(tx)).generar(CTX, '2026-02');
    expect(tx.alqContrato.findMany.mock.calls[0]![0].where).toEqual({
      estado: { in: ['vigente', 'finalizado', 'rescindido'] },
      inicio: { lte: d('2026-02-28') },
      fin: { gte: d('2026-02-01') },
    });
  });

  it('el IVA de los honorarios sale de la configuración de la inmobiliaria', async () => {
    const tx = makeTx();
    tx.tenant.findUniqueOrThrow.mockResolvedValue({ config: { ivaHonorariosPct: 0 } });
    await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
    expect(datos(tx).find((x) => x.tipo === 'honorarios')!.importe).toBe(91_001.44);
  });

  it('regla 100: con un feriado cargado, el vencimiento se corre al siguiente día hábil', async () => {
    // Si el jueves 5/11/2026 fuera feriado, el inquilino paga el viernes 6.
    const tx = makeTx({ feriados: [{ fecha: d('2026-11-05') }] });
    await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
    const alquiler = datos(tx).find((x) => x.tipo === 'alquiler' && x.sentido === 'a_cobrar')!;
    expect(alquiler.vencimiento).toEqual(d('2026-11-06'));
    // Lee los feriados del mes y de los días que le siguen, una sola vez.
    expect(tx.feriado.findMany).toHaveBeenCalledWith({
      where: { fecha: { gte: d('2026-11-01'), lte: d('2026-12-15') } },
      select: { fecha: true },
    });
  });

  it('regla 104: un contrato tomado en curso genera desde «administrado desde», prorrateado', async () => {
    const tx = makeTx({
      contratos: [
        contrato({
          administradoDesde: d('2026-11-10'),
          tramos: [
            { numero: 3, desde: d('2026-04-15'), hasta: d('2026-08-14'), importe: null },
            { numero: 4, desde: d('2026-08-15'), hasta: d('2026-12-14'), importe: dec(1_137_518) },
          ],
        }),
      ],
    });
    const r = await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
    expect(r.sinIndexar).toEqual([]);
    const alquiler = datos(tx).find((x) => x.tipo === 'alquiler' && x.sentido === 'a_cobrar')!;
    // 1.137.518 × 21/30: del 10 al 30 de noviembre.
    expect(alquiler.importe).toBe(796_262.6);
    // Regla 112: no vence el 5, antes de administrarlo, sino el día en que arranca.
    expect(alquiler.vencimiento).toEqual(d('2026-11-10'));
    expect(alquiler.claveGeneracion).toBe(`alq|c5|2026-11|2026-11-10|alquiler|a_cobrar|${INQ}`);
  });

  // La trampa de performance: las consultas no crecen con los contratos.
  it('cuatro consultas con 5 contratos y con 25 (los feriados, una sola vez)', async () => {
    for (const n of [5, 25]) {
      const tx = makeTx({
        contratos: Array.from({ length: n }, (_, i) =>
          contrato({ id: `c${i}`, codigo: String(i) }),
        ),
      });
      await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
      const consultas =
        tx.tenant.findUniqueOrThrow.mock.calls.length +
        tx.feriado.findMany.mock.calls.length +
        tx.alqContrato.findMany.mock.calls.length +
        tx.alqConcepto.createMany.mock.calls.length;
      expect(consultas).toBe(4);
      expect(datos(tx)).toHaveLength(4 * n);
    }
  });
});

describe('ConceptosService.generar: liquidación parcial (regla 130)', () => {
  // El contrato #5 indexa por IPC: el tramo 5 (desde el 15/12) se calcula con
  // el IPC de julio (base) y el de noviembre, que en diciembre todavía no salió.
  const porIpc = (over: Record<string, unknown> = {}) =>
    contrato({ ajuste: 'indexado', indice: 'IPC', ...over });
  const IPC_JULIO = { indice: 'IPC', fecha: d('2026-07-01'), valor: 12_076.3937 };
  const IPC_NOVIEMBRE = { indice: 'IPC', fecha: d('2026-11-01'), valor: 13_000 };

  it('regla 130: si el tramo espera el IPC, la parte del mes se genera con el importe anterior, como parcial', async () => {
    const tx = makeTx({ contratos: [porIpc()], valores: [IPC_JULIO] });
    const r = await new ConceptosService(makeDb(tx)).generar(CTX, '2026-12');
    expect(r.sinIndexar).toEqual([]);
    expect(r.parciales).toEqual([
      {
        contratoId: 'c5',
        codigo: '5',
        direccion: 'Calle 1',
        tramo: 5,
        desde: '2026-12-15',
        hasta: '2026-12-31',
        espera: 'el IPC de noviembre de 2026',
      },
    ]);
    const parciales = datos(tx).filter((x) => x.etapa === 'parcial');
    expect(parciales.map((x) => [x.tipo, x.sentido, x.importe, x.tramoNumero])).toEqual([
      ['alquiler', 'a_cobrar', 623_800.19, 5],
      ['gastos_adm', 'a_cobrar', 15_095.96, 5],
      ['alquiler', 'a_pagar', 623_800.19, 5],
      ['honorarios', 'a_cobrar', 60_383.86, 5],
    ]);
    expect(parciales[0]!.descripcion).toBe(
      'Alquiler 15/12 al 31/12/2026 (17/31 días) — liquidación parcial (espera el IPC de noviembre de 2026)',
    );
    // La parte del 1 al 14 es del tramo 4, ya indexado: normal, sin etapa.
    expect(
      datos(tx)
        .filter((x) => x.etapa == null)
        .map((x) => x.importe),
    ).toEqual([513_717.81, 12_431.98, 513_717.81, 49_727.88]);
    // Los valores del índice se buscan en una sola consulta.
    expect(tx.indiceValor.findMany).toHaveBeenCalledTimes(1);
  });

  it('regla 130: si el IPC ya salió y falta confirmar, no hay parcial: sigue la regla 11', async () => {
    const tx = makeTx({ contratos: [porIpc()], valores: [IPC_JULIO, IPC_NOVIEMBRE] });
    const r = await new ConceptosService(makeDb(tx)).generar(CTX, '2026-12');
    expect(r.parciales).toEqual([]);
    expect(r.sinIndexar.map((x) => x.tramo)).toEqual([5]);
    expect(datos(tx).every((x) => x.etapa == null)).toBe(true);
  });

  it('regla 130: Casa Propia no tiene fuente: el tramo sin importe espera su valor', async () => {
    const tx = makeTx({ contratos: [porIpc({ indice: 'CCP' })] });
    const r = await new ConceptosService(makeDb(tx)).generar(CTX, '2026-12');
    expect(r.parciales.map((x) => x.espera)).toEqual(['el valor de Casa Propia']);
    // Sin ICL ni IPC en juego, no se le pregunta nada a la tabla de índices.
    expect(tx.indiceValor.findMany).not.toHaveBeenCalled();
  });

  it('regla 130: un mes sin tramos sin importe no consulta los índices', async () => {
    const tx = makeTx({ contratos: [porIpc()] });
    await new ConceptosService(makeDb(tx)).generar(CTX, '2026-11');
    expect(tx.indiceValor.findMany).not.toHaveBeenCalled();
  });

  it('regla 130: las mismas consultas con 5 contratos que esperan el índice y con 25', async () => {
    const cuantas = async (n: number) => {
      const tx = makeTx({
        contratos: Array.from({ length: n }, (_, i) => porIpc({ id: `c${i}`, codigo: String(i) })),
        valores: [IPC_JULIO],
      });
      await new ConceptosService(makeDb(tx)).generar(CTX, '2026-12');
      expect(datos(tx).filter((x) => x.etapa === 'parcial')).toHaveLength(4 * n);
      return (
        tx.tenant.findUniqueOrThrow.mock.calls.length +
        tx.alqContrato.findMany.mock.calls.length +
        tx.indiceValor.findMany.mock.calls.length +
        tx.alqConcepto.findMany.mock.calls.length +
        tx.alqConcepto.createMany.mock.calls.length +
        tx.usuario.findUnique.mock.calls.length +
        tx.alqEvento.createMany.mock.calls.length
      );
    };
    expect(await cuantas(25)).toBe(await cuantas(5));
  });
});

describe('ConceptosService.crearSuelto (regla 14)', () => {
  const suelto = (over: Record<string, unknown> = {}) =>
    ConceptoSueltoInputSchema.parse({
      contratoId: '44444444-4444-4444-8444-444444444444',
      tipo: 'reparacion',
      aCargoDe: 'propietario',
      importe: 140_699,
      vencimiento: '2025-12-05',
      descripcion: 'Arreglo del aire acondicionado',
      ...over,
    });

  it('un gasto del propietario adelantado por la inmobiliaria queda marcado', async () => {
    const tx = makeTx();
    await new ConceptosService(makeDb(tx)).crearSuelto(CTX, suelto({ pagadoPor: 'inmobiliaria' }));
    expect(datos(tx)).toMatchObject([
      {
        personaId: DUENO,
        sentido: 'a_cobrar',
        importe: 140_699,
        adelantadoPorInmobiliaria: true,
        tenantId: 't1',
      },
    ]);
  });

  // Como lo registra Gexion: la reparación a pagar a uno y a cobrar al otro.
  it('si lo pagó el inquilino, se le reconoce, enlazado al cargo', async () => {
    const tx = makeTx();
    await new ConceptosService(makeDb(tx)).crearSuelto(CTX, suelto({ pagadoPor: 'inquilino' }));
    const [cargo, reconocimiento] = datos(tx);
    expect(cargo).toMatchObject({
      personaId: DUENO,
      sentido: 'a_cobrar',
      adelantadoPorInmobiliaria: false,
    });
    expect(reconocimiento).toMatchObject({
      personaId: INQ,
      sentido: 'a_pagar',
      importe: 140_699,
      origenId: cargo!.id,
    });
  });

  it('dos propietarios: se reparte por porcentaje sin perder centavos', async () => {
    const partes = [
      { personaId: DUENO, papel: 'propietario', porcentaje: dec(50) },
      { personaId: OTRO_DUENO, papel: 'propietario', porcentaje: dec(50) },
      { personaId: INQ, papel: 'inquilino', porcentaje: null },
    ];
    const tx = makeTx({ contrato: contrato({ partes }) });
    await new ConceptosService(makeDb(tx)).crearSuelto(CTX, suelto({ importe: 100.01 }));
    expect(datos(tx).map((x) => x.importe)).toEqual([50.01, 50]);
  });

  it('un contrato en borrador todavía no tiene cuenta', async () => {
    await expect(
      new ConceptosService(
        makeDb(makeTx({ contrato: contrato({ estado: 'borrador' }) })),
      ).crearSuelto(CTX, suelto()),
    ).rejects.toThrow(BadRequestException);
  });

  it('el schema rechaza que lo haya pagado quien lo debe, y un «otro» sin descripción', () => {
    expect(() => suelto({ pagadoPor: 'propietario' })).toThrow(/no hay nada que cargar/);
    expect(() => suelto({ tipo: 'otro', descripcion: '' })).toThrow(/de qué se trata/);
  });
});

describe('ConceptosService.anular (regla 19)', () => {
  it('anula con motivo y quién, y arrastra lo enlazado', async () => {
    const tx = makeTx();
    await new ConceptosService(makeDb(tx)).anular(CTX, 'k1', 'Cargado dos veces');
    expect(tx.alqConcepto.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ id: 'k1' }, { origenId: 'k1' }],
        anuladoEn: null,
        liquidacionId: null,
        imputaciones: {
          none: { cobro: { anuladoEn: null }, registradaEnCobro: { anuladoEn: null } },
        },
      },
      data: expect.objectContaining({ anuladoPorId: 'u1', motivoAnulacion: 'Cargado dos veces' }),
    });
  });

  it('con cobros aplicados o ya liquidado, no', async () => {
    const conCobro = makeTx({
      concepto: { anuladoEn: null, liquidacionId: null, _count: { imputaciones: 1 } },
    });
    await expect(new ConceptosService(makeDb(conCobro)).anular(CTX, 'k1', 'x x x')).rejects.toThrow(
      /cobros o pagos aplicados/,
    );
    const liquidado = makeTx({
      concepto: { anuladoEn: null, liquidacionId: 'l1', _count: { imputaciones: 0 } },
    });
    await expect(
      new ConceptosService(makeDb(liquidado)).anular(CTX, 'k1', 'x x x'),
    ).rejects.toThrow(BadRequestException);
    expect(conCobro.alqConcepto.updateMany).not.toHaveBeenCalled();
  });

  it('dos veces, no', async () => {
    const tx = makeTx({
      concepto: { anuladoEn: new Date(), liquidacionId: null, _count: { imputaciones: 0 } },
    });
    await expect(new ConceptosService(makeDb(tx)).anular(CTX, 'k1', 'x x x')).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('ConceptosService.listar · estado y papel (punto 4 de Javier)', () => {
  const DUENO = '11111111-1111-4111-8111-111111111111';
  const INQ = '22222222-2222-4222-8222-222222222222';
  const k = (over: Record<string, unknown>) => ({
    id: crypto.randomUUID(),
    contrato: {
      id: 'c5',
      codigo: 'ALT-0005',
      propiedad: { direccion: 'Calle 1' },
      partes: [
        { personaId: DUENO, papel: 'propietario' },
        { personaId: INQ, papel: 'inquilino' },
      ],
    },
    persona: { id: INQ, nombre: 'Inquilina' },
    personaId: INQ,
    tipo: 'alquiler',
    sentido: 'a_cobrar',
    moneda: 'ARS',
    periodo: '2026-11',
    vencimiento: new Date('2026-11-05'),
    importe: new Prisma.Decimal(1000),
    adelantadoPorInmobiliaria: false,
    descripcion: 'Alquiler',
    claveGeneracion: 'x',
    liquidacionId: null,
    anuladoEn: null,
    anuladoPorId: null,
    motivoAnulacion: null,
    creadoPorId: null,
    createdAt: new Date(),
    imputaciones: [] as { importe: Prisma.Decimal }[],
    ...over,
  });

  it('pendiente, en parte, cobrado, liquidado y anulado; y quién es cada persona', async () => {
    const tx = makeTx();
    tx.alqConcepto.findMany.mockResolvedValueOnce([
      k({}),
      k({ imputaciones: [{ importe: new Prisma.Decimal(400) }] }),
      k({ imputaciones: [{ importe: new Prisma.Decimal(1000) }] }),
      k({
        sentido: 'a_pagar',
        personaId: DUENO,
        persona: { id: DUENO, nombre: 'Dueño' },
        liquidacionId: 'l1',
      }),
      k({ anuladoEn: new Date(), anuladoPorId: 'u1', motivoAnulacion: 'Error' }),
    ]);
    const r = await new ConceptosService(makeDb(tx)).listar('2026-11');
    expect(r.map((c) => [c.estado, c.saldo])).toEqual([
      ['pendiente', 1000],
      ['parcial', 600],
      ['cobrado', 0],
      ['liquidado', 0],
      ['anulado', 0],
    ]);
    expect(r.map((c) => c.papel)).toEqual([
      'inquilino',
      'inquilino',
      'inquilino',
      'propietario',
      'inquilino',
    ]);
    expect(r[4]!.anulado).toMatchObject({ motivo: 'Error', por: 'Lucía Operadora' });
  });
});
