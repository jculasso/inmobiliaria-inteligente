import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CobroInputSchema, type CobroInput } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { CobrosService } from './cobros.service';
import { mocksDeHistorial } from './historial.testing';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const PERSONA = '11111111-1111-4111-8111-111111111111';
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

/* Noviembre de 2026 del contrato #5 (Gexion), con 0,1% diario de punitorio. */
function concepto(over: Record<string, unknown> = {}) {
  return {
    id: uuid(),
    tipo: 'alquiler',
    sentido: 'a_cobrar',
    moneda: 'ARS',
    importe: dec(1_137_518),
    vencimiento: d('2026-11-05'),
    createdAt: new Date('2026-10-20T10:00:00Z'),
    periodo: '2026-11',
    origenId: null,
    liquidacionId: null,
    descripcion: 'Alquiler noviembre 2026',
    contrato: { id: 'c5', codigo: '5', punitorioDiarioPct: dec(0.1) },
    anuladoEn: null,
    imputaciones: [] as { importe: Prisma.Decimal }[],
    ...over,
  };
}

function cobro(over: Record<string, unknown> = {}) {
  return {
    id: uuid(),
    numero: 7,
    moneda: 'ARS',
    fecha: d('2026-10-10'),
    createdAt: new Date('2026-10-10T10:00:00Z'),
    importe: dec(50_000),
    anuladoEn: null,
    imputaciones: [] as { importe: Prisma.Decimal; concepto: { sentido: string } }[],
    ...over,
  };
}

const filaCobro = {
  id: 'nuevo',
  numero: 8,
  persona: { id: PERSONA, nombre: 'Inquilino' },
  fecha: d('2026-11-05'),
  moneda: 'ARS',
  importe: dec(1),
  medio: 'transferencia',
  obs: null,
  registradas: [],
  imputaciones: [],
  anuladoEn: null,
  motivoAnulacion: null,
};

function makeTx(over: { conceptos?: unknown[]; cobros?: unknown[]; cobroAAnular?: unknown } = {}) {
  return {
    ...mocksDeHistorial(),
    $executeRaw: vi.fn().mockResolvedValue(1),
    alqPersona: { findUnique: vi.fn().mockResolvedValue({ id: PERSONA, nombre: 'Inquilino' }) },
    alqConcepto: {
      findMany: vi.fn().mockResolvedValue(over.conceptos ?? []),
      createMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    alqCobro: {
      findMany: vi.fn().mockResolvedValue(over.cobros ?? []),
      aggregate: vi.fn().mockResolvedValue({ _max: { numero: 7 } }),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue(filaCobro),
      findUnique: vi.fn().mockResolvedValue(over.cobroAAnular ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    alqImputacion: { createMany: vi.fn() },
    alqLiquidacion: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
}

const input = (over: Partial<CobroInput> = {}) =>
  CobroInputSchema.parse({ personaId: PERSONA, fecha: '2026-11-05', importe: 1_150_000, ...over });
const imputaciones = (tx: ReturnType<typeof makeTx>) =>
  (
    tx.alqImputacion.createMany.mock.calls[0]?.[0] as {
      data: { cobroId: string; conceptoId: string; importe: number; registradaEnCobroId: string }[];
    }
  ).data;

describe('CobrosService.registrar (reglas 15 a 17)', () => {
  // Regla 15: del más viejo al más nuevo, el último parcial.
  it('imputa del vencimiento más viejo al más nuevo, y el último queda parcial', async () => {
    const gastos = concepto({
      tipo: 'gastos_adm',
      importe: dec(27_527.94),
      descripcion: 'Gastos administrativos noviembre 2026',
    });
    const octubre = concepto({
      vencimiento: d('2026-10-05'),
      descripcion: 'Alquiler octubre 2026',
    });
    const noviembre = concepto();
    const tx = makeTx({ conceptos: [gastos, noviembre, octubre] });
    await new CobrosService(makeDb(tx)).registrar(
      CTX,
      input({ importe: 1_150_000, fecha: '2026-10-05' }),
    );
    const cobroId = tx.alqCobro.create.mock.calls[0]![0].data.id;
    expect(imputaciones(tx).map((i) => [i.conceptoId, i.importe])).toEqual([
      [octubre.id, 1_137_518],
      [gastos.id, 12_482],
    ]);
    expect(
      imputaciones(tx).every((i) => i.cobroId === cobroId && i.registradaEnCobroId === cobroId),
    ).toBe(true);
  });

  it('el número del recibo es el siguiente, sacado con el candado de la inmobiliaria', async () => {
    const tx = makeTx({ conceptos: [concepto()] });
    await new CobrosService(makeDb(tx)).registrar(CTX, input());
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.alqCobro.create.mock.calls[0]![0].data).toMatchObject({
      numero: 8,
      tenantId: 't1',
      creadoPorId: 'u1',
      medio: 'transferencia',
    });
  });

  // Regla 17: lo que sobró antes se usa primero, y queda registrado en este cobro.
  it('usa el saldo a favor de un cobro anterior', async () => {
    const viejo = cobro({ importe: dec(34_954.06) });
    const alquiler = concepto();
    const tx = makeTx({ conceptos: [alquiler], cobros: [viejo] });
    await new CobrosService(makeDb(tx)).registrar(CTX, input({ importe: 1_102_563.94 }));
    const nuevoId = tx.alqCobro.create.mock.calls[0]![0].data.id;
    expect(imputaciones(tx)).toEqual([
      expect.objectContaining({
        cobroId: viejo.id,
        conceptoId: alquiler.id,
        importe: 34_954.06,
        registradaEnCobroId: nuevoId,
      }),
      expect.objectContaining({
        cobroId: nuevoId,
        conceptoId: alquiler.id,
        importe: 1_102_563.94,
        registradaEnCobroId: nuevoId,
      }),
    ]);
  });

  it('un reintegro a favor del inquilino se compensa contra lo que debe', async () => {
    const reparacion = concepto({
      tipo: 'reparacion',
      sentido: 'a_pagar',
      importe: dec(140_699),
      descripcion: 'Arreglo del aire',
    });
    const alquiler = concepto();
    const tx = makeTx({ conceptos: [alquiler, reparacion] });
    await new CobrosService(makeDb(tx)).registrar(CTX, input({ importe: 996_819 }));
    expect(imputaciones(tx).map((i) => [i.conceptoId, i.importe])).toEqual([
      [reparacion.id, 140_699],
      [alquiler.id, 1_137_518],
    ]);
  });

  // Los honorarios se descuentan en la liquidación, no se cobran por caja.
  it('los honorarios no entran en un cobro', async () => {
    const honorarios = concepto({ tipo: 'honorarios', importe: dec(110_111.74) });
    const tx = makeTx({ conceptos: [honorarios] });
    const prep = await new CobrosService(makeDb(tx)).preparar(PERSONA, 'ARS', '2026-11-05');
    expect(prep.deudas).toEqual([]);
  });

  it('elegir un concepto que no es deuda de la persona se rechaza', async () => {
    const tx = makeTx({ conceptos: [concepto()] });
    await expect(
      new CobrosService(makeDb(tx)).registrar(
        CTX,
        input({ conceptoIds: ['99999999-9999-4999-8999-999999999999'] }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('un concepto ya pagado del todo no es deuda', async () => {
    const pagado = concepto({ imputaciones: [{ importe: dec(1_137_518) }] });
    const prep = await new CobrosService(makeDb(makeTx({ conceptos: [pagado] }))).preparar(
      PERSONA,
      'ARS',
      '2026-11-05',
    );
    expect(prep.deudas).toEqual([]);
  });

  // La trampa de performance: las consultas no crecen con los conceptos.
  it('las mismas consultas con 5 conceptos y con 25', async () => {
    const cuenta = async (k: number) => {
      const tx = makeTx({ conceptos: Array.from({ length: k }, () => concepto()) });
      await new CobrosService(makeDb(tx)).registrar(CTX, input({ importe: 10 }));
      return [
        tx.alqConcepto.findMany,
        tx.alqCobro.findMany,
        tx.alqCobro.aggregate,
        tx.alqCobro.create,
        tx.alqImputacion.createMany,
      ].reduce((s, f) => s + f.mock.calls.length, 0);
    };
    expect(await cuenta(5)).toBe(await cuenta(25));
  });
});

describe('CobrosService · punitorio (regla 16)', () => {
  it('propone saldo × tasa × días de atraso', async () => {
    const prep = await new CobrosService(makeDb(makeTx({ conceptos: [concepto()] }))).preparar(
      PERSONA,
      'ARS',
      '2026-11-15',
    );
    expect(prep.deudas[0]!.punitorio).toEqual({ dias: 10, importe: 11_375.18 });
  });

  it('se cobra como concepto propio, enlazado al alquiler y al cobro, y se cancela junto a él', async () => {
    const alquiler = concepto();
    const gastos = concepto({ tipo: 'gastos_adm', importe: dec(27_527.94) });
    const tx = makeTx({ conceptos: [alquiler, gastos] });
    await new CobrosService(makeDb(tx)).registrar(
      CTX,
      input({
        fecha: '2026-11-15',
        importe: 2_000_000,
        punitorios: [{ conceptoId: alquiler.id, importe: 11_375.18 }],
      }),
    );
    const [punitorio] = tx.alqConcepto.createMany.mock.calls[0]![0].data as {
      id: string;
      [k: string]: unknown;
    }[];
    const cobroId = tx.alqCobro.create.mock.calls[0]![0].data.id;
    expect(punitorio).toMatchObject({
      tipo: 'punitorio',
      sentido: 'a_cobrar',
      importe: 11_375.18,
      origenId: alquiler.id,
      cobroId,
      descripcion: 'Punitorio 10 días · Alquiler noviembre 2026',
    });
    expect(imputaciones(tx).map((i) => i.conceptoId)).toEqual([
      alquiler.id,
      punitorio!.id,
      gastos.id,
    ]);
  });

  it('más que lo calculado, no', async () => {
    const alquiler = concepto();
    await expect(
      new CobrosService(makeDb(makeTx({ conceptos: [alquiler] }))).registrar(
        CTX,
        input({ fecha: '2026-11-15', punitorios: [{ conceptoId: alquiler.id, importe: 20_000 }] }),
      ),
    ).rejects.toThrow(/no puede superar/);
  });

  it('condonar pide motivo, y la condonación queda escrita en el cobro', async () => {
    const alquiler = concepto();
    const svc = () => new CobrosService(makeDb(tx));
    let tx = makeTx({ conceptos: [alquiler] });
    await expect(
      svc().registrar(
        CTX,
        input({ fecha: '2026-11-15', punitorios: [{ conceptoId: alquiler.id, importe: 5_000 }] }),
      ),
    ).rejects.toThrow(/hace falta el motivo/);
    tx = makeTx({ conceptos: [alquiler] });
    await svc().registrar(
      CTX,
      input({
        fecha: '2026-11-15',
        punitorios: [
          { conceptoId: alquiler.id, importe: 0, motivo: 'Avisó que la transferencia se demoraba' },
        ],
      }),
    );
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
    expect(tx.alqCobro.create.mock.calls[0]![0].data.obs).toBe(
      'Punitorio condonado de Alquiler noviembre 2026: $ 11.375,18 (Avisó que la transferencia se demoraba).',
    );
  });

  it('después de un punitorio cobrado, los días corren desde ese cobro', async () => {
    const alquiler = concepto({ imputaciones: [{ importe: dec(1_000_000) }] });
    const previo = concepto({
      tipo: 'punitorio',
      origenId: alquiler.id,
      vencimiento: d('2026-11-15'),
      importe: dec(11_375.18),
      imputaciones: [{ importe: dec(11_375.18) }],
    });
    const prep = await new CobrosService(
      makeDb(makeTx({ conceptos: [alquiler, previo] })),
    ).preparar(PERSONA, 'ARS', '2026-11-20');
    expect(prep.deudas[0]!.punitorio).toEqual({ dias: 5, importe: 687.59 }); // 137.518 × 0,1% × 5
  });
});

describe('CobrosService.anular (regla 19)', () => {
  it('anula el cobro y los punitorios que nacieron con él', async () => {
    const tx = makeTx({
      cobroAAnular: {
        anuladoEn: null,
        numero: 8,
        imputaciones: [],
        conceptos: [],
        registradas: [],
      },
    });
    await new CobrosService(makeDb(tx)).anular(CTX, 'nuevo', 'Transferencia rechazada');
    expect(tx.alqCobro.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: 'nuevo', anuladoEn: null },
      data: { anuladoPorId: 'u1', motivoAnulacion: 'Transferencia rechazada' },
    });
    expect(tx.alqConcepto.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { cobroId: 'nuevo', anuladoEn: null },
      data: { motivoAnulacion: 'Anulación del recibo 8' },
    });
  });

  it('si su saldo a favor ya se usó en otro cobro, primero hay que anular ese', async () => {
    const tx = makeTx({
      cobroAAnular: {
        anuladoEn: null,
        numero: 7,
        imputaciones: [{ registradaEnCobro: { numero: 9 } }],
        conceptos: [],
        registradas: [],
      },
    });
    await expect(new CobrosService(makeDb(tx)).anular(CTX, 'viejo', 'x x x')).rejects.toThrow(
      'El saldo a favor de este cobro se usó en el recibo 9: anulá ese primero.',
    );
    expect(tx.alqCobro.updateMany).not.toHaveBeenCalled();
  });
});

describe('CobrosService.anular · liquidaciones (regla 22)', () => {
  it('si el alquiler que canceló ya se le liquidó al dueño, primero hay que anular la liquidación', async () => {
    const registradas = [
      {
        concepto: {
          claveGeneracion: 'alq|c5|2026-11|2026-11-01|alquiler|a_cobrar|inq',
          tipo: 'alquiler',
        },
      },
    ];
    const tx = makeTx({
      cobroAAnular: { anuladoEn: null, numero: 8, imputaciones: [], conceptos: [], registradas },
    });
    tx.alqConcepto.findFirst.mockResolvedValue({ liquidacion: { numero: 3 } });
    await expect(new CobrosService(makeDb(tx)).anular(CTX, 'nuevo', 'x x x')).rejects.toThrow(
      'ya se le liquidó al propietario (liquidación 3)',
    );
    expect(tx.alqConcepto.findFirst.mock.calls[0]![0].where).toMatchObject({
      sentido: 'a_pagar',
      liquidacion: { anuladoEn: null },
      contrato: { pagoGarantizado: false },
      OR: [{ claveGeneracion: { startsWith: 'alq|c5|2026-11|2026-11-01|' } }],
    });
    expect(tx.alqCobro.updateMany).not.toHaveBeenCalled();
  });
});

describe('CobrosService.cuenta (reglas 18 y 24)', () => {
  /*
   * Un mes con todo: alquiler y gastos, un reintegro compensado, un cobro que
   * deja saldo a favor DESPUÉS de compensar (donde un signo mal puesto se nota),
   * uno anulado, y una deuda en dólares aparte.
   */
  function escenario() {
    const alquiler = concepto({ imputaciones: [{ importe: dec(1_137_518) }] });
    const gastos = concepto({
      tipo: 'gastos_adm',
      importe: dec(27_527.94),
      imputaciones: [{ importe: dec(10_000) }],
    });
    const reparacion = concepto({
      tipo: 'reparacion',
      sentido: 'a_pagar',
      importe: dec(140_699),
      imputaciones: [{ importe: dec(140_699) }],
    });
    const anuladoK = concepto({ tipo: 'expensa', importe: dec(85_000), anuladoEn: new Date() });
    const usd = concepto({
      moneda: 'USD',
      importe: dec(500),
      contrato: { id: 'c9', codigo: '9', punitorioDiarioPct: dec(0) },
    });
    const pago = cobro({
      fecha: d('2026-11-05'),
      importe: dec(1_110_000),
      imputaciones: [
        { importe: dec(140_699), concepto: { sentido: 'a_pagar' } },
        { importe: dec(1_137_518), concepto: { sentido: 'a_cobrar' } },
        { importe: dec(10_000), concepto: { sentido: 'a_cobrar' } },
      ],
    });
    const anulado = cobro({ fecha: d('2026-11-06'), importe: dec(999_999), anuladoEn: new Date() });
    return makeTx({
      conceptos: [alquiler, gastos, reparacion, anuladoK, usd],
      cobros: [pago, anulado],
    });
  }

  it('lo pendiente suma exactamente el saldo de la cuenta corriente', async () => {
    const r = await new CobrosService(makeDb(escenario())).cuenta(PERSONA);
    const ars = r.monedas.find((m) => m.moneda === 'ARS')!;
    // 1.137.518 + 27.527,94 − 140.699 − 1.110.000 = −85.653,06: tiene a favor.
    expect(ars.saldo).toBe(-85_653.06);
    // El cobro dejó 103.181 a favor: 1.110.000 + 140.699 compensados − 1.147.518 imputados.
    expect(ars.aFavor.map((c) => c.disponible)).toEqual([103_181]);
    const pendiente =
      ars.pendientes.reduce((s, p) => s + (p.sentido === 'a_cobrar' ? p.saldo : -p.saldo), 0) -
      ars.aFavor.reduce((s, c) => s + c.disponible, 0);
    expect(pendiente).toBeCloseTo(ars.saldo, 2);
  });

  it('lo anulado se ve pero no mueve el saldo', async () => {
    const ars = (await new CobrosService(makeDb(escenario())).cuenta(PERSONA)).monedas.find(
      (m) => m.moneda === 'ARS',
    )!;
    expect(ars.movimientos.filter((m) => m.anulado)).toHaveLength(2);
    expect(ars.movimientos.at(-1)!.saldo).toBe(-85_653.06);
  });

  // Regla 20: lo liquidado ya no está pendiente, y el pago al dueño es un movimiento.
  it('un propietario liquidado: el concepto queda saldado y la liquidación salda la cuenta', async () => {
    const alquiler = concepto({ sentido: 'a_pagar', liquidacionId: 'liq' });
    const honorarios = concepto({
      tipo: 'honorarios',
      importe: dec(110_111.74),
      liquidacionId: 'liq',
    });
    const tx = makeTx({ conceptos: [alquiler, honorarios] });
    tx.alqLiquidacion.findMany.mockResolvedValue([
      {
        id: uuid(),
        numero: 3,
        moneda: 'ARS',
        fecha: d('2026-11-12'),
        neto: dec(1_027_406.26),
        anuladoEn: null,
        createdAt: new Date('2026-11-12T10:00:00Z'),
      },
    ]);
    const ars = (await new CobrosService(makeDb(tx)).cuenta(PERSONA)).monedas[0]!;
    expect(ars.pendientes).toEqual([]);
    expect(ars.saldo).toBe(0);
    expect(ars.movimientos.at(-1)).toMatchObject({
      tipo: 'liquidacion',
      descripcion: 'Liquidación 3',
      debe: 1_027_406.26,
    });
  });

  it('cada moneda es una cuenta aparte', async () => {
    const r = await new CobrosService(makeDb(escenario())).cuenta(PERSONA);
    expect(r.monedas.map((m) => [m.moneda, m.saldo])).toEqual([
      ['ARS', -85_653.06],
      ['USD', 500],
    ]);
  });
});
