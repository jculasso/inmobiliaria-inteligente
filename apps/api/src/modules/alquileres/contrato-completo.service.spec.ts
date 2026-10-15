import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TenantConfigSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import {
  ContratoCompletoService,
  estadoDeposito,
  mesesDeContrato,
  propuesta,
} from './contrato-completo.service';
import { mocksDeHistorial } from './historial.testing';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: number) => new Prisma.Decimal(n);
const INQ = '22222222-2222-4222-8222-222222222222';
const DUENO = '11111111-1111-4111-8111-111111111111';

const contrato = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  codigo: 'ALT-0090',
  estado: 'vigente',
  tipo: 'vivienda',
  moneda: 'ARS',
  inquilinoMipyme: false,
  administradoDesde: null,
  inicio: d('2026-03-01'),
  fin: d('2028-02-29'),
  fechaFirma: d('2026-02-20'),
  depositoImporte: dec(350_000),
  depositoMoneda: 'ARS',
  depositoDevolucion: null,
  depositoGestion: 'entrega_propietario',
  partes: [
    { personaId: INQ, papel: 'inquilino', porcentaje: null },
    { personaId: DUENO, papel: 'propietario', porcentaje: dec(100) },
  ],
  tramos: [{ numero: 1, importe: dec(350_000) }],
  ...over,
});

describe('Cargos de ingreso (punto 7 de Javier, con los números de Gexion)', () => {
  it('un contrato de dos años son 24 meses', () => {
    expect(mesesDeContrato('2026-03-01', '2028-02-29')).toBe(24);
    expect(mesesDeContrato('2026-03-15', '2027-03-14')).toBe(12);
  });

  it('comisión: 5% del valor total + IVA, en dos cuotas; el depósito y nada de sellado en un particular (regla 103: exento)', () => {
    const p = propuesta(contrato() as never, TenantConfigSchema.parse({}), 350_000 * 24);
    expect(p.map((x) => [x.tipo, x.descripcion, x.aCargoDe, x.importe, x.vencimiento])).toEqual([
      ['comision', 'Comisión inicial 1 de 2', 'inquilino', 254_100, '2026-02-20'],
      ['comision', 'Comisión inicial 2 de 2', 'inquilino', 254_100, '2026-03-20'],
      ['deposito', 'Depósito en garantía', 'inquilino', 350_000, '2026-02-20'],
    ]);
  });

  it('regla 103: una alícuota única guardada antes del 15/10/2026 se conserva, y su reparto también', () => {
    const p = propuesta(
      contrato({ depositoImporte: null }) as never,
      TenantConfigSchema.parse({ comisionInicialPct: 0, selladoPct: 1.2, selladoInquilinoPct: 50 }),
      8_400_000,
    );
    expect(p.map((x) => [x.aCargoDe, x.importe])).toEqual([
      ['inquilino', 50_400],
      ['propietario', 50_400],
    ]);
  });

  describe('regla 103: el sellado según el tipo de contrato (Florencia, Vacker, 15/10/2026)', () => {
    const sinComision = TenantConfigSchema.parse({ comisionInicialPct: 0 });
    const sellado = (over: Record<string, unknown>) =>
      propuesta(contrato({ depositoImporte: null, ...over }) as never, sinComision, 8_400_000)
        .filter((x) => x.tipo === 'sellado')
        .map((x) => [x.descripcion, x.aCargoDe, x.importe]);

    it('un particular está exento: no lleva sellado', () => {
      expect(sellado({ tipo: 'vivienda' })).toEqual([]);
    });

    it('un comercial paga el 1% del valor total, todo a cargo del inquilino', () => {
      expect(sellado({ tipo: 'comercial' })).toEqual([
        ['Sellado del contrato (1%)', 'inquilino', 84_000],
      ]);
    });

    it('un comercial con inquilino MiPyme, el 0,25%', () => {
      expect(sellado({ tipo: 'comercial', inquilinoMipyme: true })).toEqual([
        ['Sellado del contrato (0,25%, MiPyme)', 'inquilino', 21_000],
      ]);
    });

    it('el certificado MiPyme no cambia nada en un particular', () => {
      expect(sellado({ tipo: 'vivienda', inquilinoMipyme: true })).toEqual([]);
    });
  });

  it('regla 105: un contrato tomado en curso no propone cargos de ingreso', async () => {
    const tx = {
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ config: {} }) },
      alqContrato: {
        findUnique: vi
          .fn()
          .mockResolvedValue(contrato({ tipo: 'comercial', administradoDesde: d('2026-10-01') })),
      },
      alqConcepto: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      alqGarantia: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as TenantPrismaService;
    const r = await new ContratoCompletoService(db).obtener(CTX, 'c1');
    expect(r.cargos).toMatchObject({ cargados: false, enCurso: true, propuesta: [] });
    // El mismo contrato sin «administrado desde» sí los propone.
    tx.alqContrato.findUnique.mockResolvedValue(contrato({ tipo: 'comercial' }));
    const nuevo = await new ContratoCompletoService(db).obtener(CTX, 'c1');
    expect(nuevo.cargos.enCurso).toBe(false);
    expect(nuevo.cargos.propuesta.map((x) => x.tipo)).toEqual([
      'comision',
      'comision',
      'deposito',
      'sellado',
    ]);
  });

  it('se cargan una sola vez: la segunda, 409', async () => {
    const tx = {
      ...mocksDeHistorial(),
      alqContrato: { findUnique: vi.fn().mockResolvedValue(contrato()) },
      alqConcepto: { count: vi.fn().mockResolvedValue(2), createMany: vi.fn() },
    };
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as TenantPrismaService;
    await expect(
      new ContratoCompletoService(db).cargarCargos(CTX, 'c1', [
        {
          tipo: 'informe',
          descripcion: 'Informe de dominio',
          aCargoDe: 'inquilino',
          importe: 30_000,
          vencimiento: '2026-02-20',
          moneda: null,
        },
      ]),
    ).rejects.toThrow(/ya se cargaron/);
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
  });
});

describe('Depósito en garantía (punto 12)', () => {
  const k = (sentido: string, clave: string, importe: number, pagado = 0) => ({
    sentido,
    importe: dec(importe),
    moneda: 'ARS',
    claveGeneracion: clave,
    imputaciones: pagado ? [{ importe: dec(pagado) }] : [],
  });

  it('a cobrar → cobrado → entregado → devuelto', () => {
    const c = contrato();
    expect(estadoDeposito(c as never, []).estado).toBe('a_cobrar');
    expect(estadoDeposito(c as never, [k('a_cobrar', 'ing|c1|2|x', 350_000, 100_000)]).estado).toBe(
      'a_cobrar',
    );
    expect(
      estadoDeposito(c as never, [k('a_cobrar', 'ing|c1|2|x', 350_000, 350_000)]),
    ).toMatchObject({ estado: 'cobrado', cobrado: 350_000 });
    expect(
      estadoDeposito(c as never, [
        k('a_cobrar', 'ing|c1|2|x', 350_000, 350_000),
        k('a_pagar', 'dep|c1|entrega|y', 350_000),
      ]).estado,
    ).toBe('entregado');
    expect(
      estadoDeposito(contrato({ depositoDevolucion: d('2028-03-05') }) as never, []).estado,
    ).toBe('devuelto');
    expect(estadoDeposito(contrato({ depositoImporte: null }) as never, []).estado).toBe(
      'sin_deposito',
    );
  });

  it('no se entrega al propietario lo que el inquilino no pagó', async () => {
    const tx = {
      ...mocksDeHistorial(),
      alqContrato: { findUnique: vi.fn().mockResolvedValue(contrato()) },
      alqConcepto: {
        findMany: vi.fn().mockResolvedValue([k('a_cobrar', 'ing|c1|2|x', 350_000, 100_000)]),
        createMany: vi.fn(),
      },
    };
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as TenantPrismaService;
    await expect(new ContratoCompletoService(db).entregarDeposito(CTX, 'c1')).rejects.toThrow(
      /todavía no pagó el depósito/,
    );
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
  });

  it('entregarlo crea lo que se le paga al propietario en su liquidación', async () => {
    const tx = {
      ...mocksDeHistorial(),
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ config: {} }) },
      alqContrato: { findUnique: vi.fn().mockResolvedValue(contrato()) },
      alqConcepto: {
        findMany: vi.fn().mockResolvedValue([k('a_cobrar', 'ing|c1|2|x', 350_000, 350_000)]),
        createMany: vi.fn(),
        count: vi.fn().mockResolvedValue(3),
      },
      alqGarantia: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const db = {
      withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    } as unknown as TenantPrismaService;
    await new ContratoCompletoService(db).entregarDeposito(CTX, 'c1');
    expect(tx.alqConcepto.createMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({
        personaId: DUENO,
        tipo: 'deposito',
        sentido: 'a_pagar',
        importe: 350_000,
        claveGeneracion: `dep|c1|entrega|${DUENO}`,
      }),
    ]);
  });
});
