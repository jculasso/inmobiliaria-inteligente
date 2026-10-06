import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LoteBoletasSchema, PolizaInputSchema, cuotaSiguiente } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { ImpuestosService, conceptosDeBoleta, contratoDelMes } from './impuestos.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const C5 = '55555555-5555-4555-8555-555555555555';
const C4 = '44444444-4444-4444-8444-444444444444';
const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '12121212-1212-4121-8121-121212121212';
const INQ = '22222222-2222-4222-8222-222222222222';
const API = '33333333-3333-4333-8333-333333333333';
const EPE = '66666666-6666-4666-8666-666666666666';
const VACIA = '77777777-7777-4777-8777-777777777777';
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const PARTES = [
  { personaId: D1, papel: 'propietario', porcentaje: new Prisma.Decimal(60) },
  { personaId: D2, papel: 'propietario', porcentaje: new Prisma.Decimal(40) },
  { personaId: INQ, papel: 'inquilino', porcentaje: null },
];
const contrato = (id: string, inicio: string, fin: string, rescindidoEl: string | null = null) => ({
  id,
  codigo: id === C5 ? 'ALT-0005' : 'ALT-0004',
  estado: 'vigente',
  inicio: d(inicio),
  fin: d(fin),
  rescindidoEl: rescindidoEl ? d(rescindidoEl) : null,
  moneda: 'ARS',
  partes: PARTES,
});
const cuenta = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  numeroCuenta: '12-345',
  aCargoDe: 'inquilino',
  paga: 'inmobiliaria',
  servicio: {
    id: 's1',
    nombre: id === EPE ? 'EPE (Luz)' : 'API (Impuesto inmobiliario)',
    clase: id === EPE ? 'servicio' : 'impuesto',
  },
  propiedad: {
    id: 'p1',
    direccion: 'Mendoza 3340',
    unidad: null,
    contratos: [contrato(C5, '2025-08-15', '2027-08-14')],
  },
  ...over,
});

function armar(over: { cuentas?: unknown[]; ya?: string[] } = {}) {
  const tx = {
    ...mocksDeHistorial(),
    alqCuentaServicio: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          over.cuentas ?? [
            cuenta(API),
            cuenta(EPE, { aCargoDe: 'propietario', paga: 'inquilino' }),
          ],
        ),
    },
    alqBoleta: {
      findMany: vi.fn().mockResolvedValue((over.ya ?? []).map((clave) => ({ clave }))),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    alqPoliza: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    alqContrato: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ codigo: 'ALT-0005', estado: 'vigente', partes: PARTES }),
    },
    alqConcepto: {
      createMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  return { tx, servicio: new ImpuestosService(db) };
}
type K = {
  personaId: string;
  sentido: string;
  importe: number;
  adelantadoPorInmobiliaria?: boolean;
  origenId?: string;
  tipo: string;
};
const resumen = (data: K[]) => data.map((k) => [k.personaId, k.sentido, k.importe, k.tipo]);

describe('ImpuestosService (entrega 19)', () => {
  describe('quién la debe y quién la paga (la contraparte)', () => {
    const b = {
      id: 'b1',
      tenantId: 't1',
      contratoId: C5,
      periodo: '2026-10',
      vencimiento: '2026-10-10',
      importe: 45_000,
      moneda: 'ARS',
    };

    it('la paga la inmobiliaria: se le cobra a quien la debe, adelantado', () => {
      const k = conceptosDeBoleta(
        { ...b, aCargoDe: 'inquilino', paga: 'inmobiliaria' },
        PARTES,
        'impuesto',
        'API',
        'u1',
      );
      expect(k).toEqual([
        expect.objectContaining({
          personaId: INQ,
          sentido: 'a_cobrar',
          importe: 45_000,
          adelantadoPorInmobiliaria: true,
        }),
      ]);
    });

    it('la paga el inquilino y la debe el propietario: cargo a los dueños por porcentaje y reconocimiento al inquilino', () => {
      const k = conceptosDeBoleta(
        { ...b, aCargoDe: 'propietario', paga: 'inquilino' },
        PARTES,
        'impuesto',
        'API',
        'u1',
      );
      expect(resumen(k as K[])).toEqual([
        [D1, 'a_cobrar', 27_000, 'impuesto'],
        [D2, 'a_cobrar', 18_000, 'impuesto'],
        [INQ, 'a_pagar', 45_000, 'impuesto'],
      ]);
      expect(k[2]!.origenId).toBe(k[0]!.id);
    });

    it('la paga quien la debe: no se carga nada, solo se controla', () => {
      expect(
        conceptosDeBoleta(
          { ...b, aCargoDe: 'inquilino', paga: 'inquilino' },
          PARTES,
          'servicio',
          'EPE',
          'u1',
        ),
      ).toEqual([]);
    });
  });

  it('el contrato de la boleta es el que estaba en curso ese mes, el más nuevo si se pisan', () => {
    const viejo = contrato(C4, '2023-08-01', '2025-07-31');
    const nuevo = contrato(C5, '2025-07-15', '2027-07-14');
    expect(contratoDelMes([viejo, nuevo], '2025-07')?.id).toBe(C5);
    expect(contratoDelMes([viejo, nuevo], '2025-06')?.id).toBe(C4);
    expect(contratoDelMes([viejo, nuevo], '2027-08')).toBeNull();
    // Un rescindido termina cuando se rescindió, no en su fin.
    expect(
      contratoDelMes([contrato(C5, '2025-08-15', '2027-08-14', '2026-03-10')], '2026-04'),
    ).toBeNull();
  });

  it('carga en lote: una boleta por fila, los conceptos de todas juntos, sin repetir la misma cuota del mismo mes', async () => {
    const { tx, servicio } = armar({ ya: [`cuenta|${API}|2026-10|3/6`] });
    const r = await servicio.cargarLote(
      CTX,
      LoteBoletasSchema.parse({
        periodo: '2026-10',
        boletas: [
          { cuentaId: API, cuota: '3/6', vencimiento: '2026-10-10', importe: 45_000 },
          { cuentaId: API, cuota: '4/6', vencimiento: '2026-10-20', importe: 45_000 },
          { cuentaId: EPE, vencimiento: '2026-10-15', importe: 30_000 },
        ],
      }),
    );
    expect(r).toEqual({ creadas: 2, repetidas: 1, sinContrato: 0 });
    expect(tx.alqBoleta.createMany).toHaveBeenCalledTimes(1);
    expect(tx.alqConcepto.createMany).toHaveBeenCalledTimes(1);
    expect(resumen(tx.alqConcepto.createMany.mock.calls[0]![0].data)).toEqual([
      [INQ, 'a_cobrar', 45_000, 'impuesto'],
      [D1, 'a_cobrar', 18_000, 'servicio'],
      [D2, 'a_cobrar', 12_000, 'servicio'],
      [INQ, 'a_pagar', 30_000, 'servicio'],
    ]);
    expect(tx.alqConcepto.createMany.mock.calls[0]![0].data[0].descripcion).toBe(
      'API (Impuesto inmobiliario) cuota 4/6 · cuenta 12-345',
    );
  });

  it('carga en lote: las mismas consultas con 5 boletas que con 25', async () => {
    const consultas = async (n: number) => {
      const cuentas = Array.from({ length: n }, (_, i) =>
        cuenta(`${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`),
      );
      const { tx, servicio } = armar({ cuentas });
      await servicio.cargarLote(
        CTX,
        LoteBoletasSchema.parse({
          periodo: '2026-10',
          boletas: cuentas.map((c) => ({
            cuentaId: c.id,
            vencimiento: '2026-10-10',
            importe: 1000,
          })),
        }),
      );
      return [
        tx.alqCuentaServicio.findMany,
        tx.alqBoleta.findMany,
        tx.alqBoleta.createMany,
        tx.alqConcepto.createMany,
        tx.alqEvento.createMany,
        tx.usuario.findUnique,
      ].map((f) => f.mock.calls.length);
    };
    expect(await consultas(5)).toEqual(await consultas(25));
  });

  it('una propiedad sin contrato ese mes: la boleta queda para control, sin cargársela a nadie', async () => {
    const { tx, servicio } = armar({
      cuentas: [
        cuenta(VACIA, {
          propiedad: { id: 'p2', direccion: 'Vacía 1', unidad: null, contratos: [] },
        }),
      ],
    });
    const r = await servicio.cargarLote(
      CTX,
      LoteBoletasSchema.parse({
        periodo: '2026-10',
        boletas: [{ cuentaId: VACIA, vencimiento: '2026-10-10', importe: 1000 }],
      }),
    );
    expect(r).toEqual({ creadas: 1, repetidas: 0, sinContrato: 1 });
    expect(tx.alqBoleta.createMany.mock.calls[0]![0].data[0].contratoId).toBeNull();
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
  });

  it('póliza en cuotas: una boleta por mes con el premio repartido sin perder centavos', async () => {
    const { tx, servicio } = armar();
    await servicio.crearPoliza(
      CTX,
      PolizaInputSchema.parse({
        contratoId: C5,
        aseguradora: 'Sancor',
        numero: '123',
        desde: '2026-10-01',
        hasta: '2027-09-30',
        premio: 100_000,
        cuotas: 3,
        primerVencimiento: '2026-10-31',
      }),
    );
    const boletas = tx.alqBoleta.createMany.mock.calls[0]![0].data as {
      cuota: string;
      importe: number;
      vencimiento: Date;
      periodo: string;
    }[];
    expect(
      boletas.map((b) => [b.cuota, b.importe, b.vencimiento.toISOString().slice(0, 10), b.periodo]),
    ).toEqual([
      ['1/3', 33_333.34, '2026-10-31', '2026-10'],
      ['2/3', 33_333.33, '2026-11-30', '2026-11'],
      ['3/3', 33_333.33, '2026-12-31', '2026-12'],
    ]);
    // Por defecto la paga la inmobiliaria y la debe el inquilino.
    expect(
      resumen(tx.alqConcepto.createMany.mock.calls[0]![0].data).map((k) => k.slice(0, 3)),
    ).toEqual([
      [INQ, 'a_cobrar', 33_333.34],
      [INQ, 'a_cobrar', 33_333.33],
      [INQ, 'a_cobrar', 33_333.33],
    ]);
  });

  it('anular una boleta ya cobrada o liquidada: no', async () => {
    const { tx, servicio } = armar();
    tx.alqBoleta.findUnique.mockResolvedValue({
      anuladoEn: null,
      contratoId: C5,
      periodo: '2026-10',
    });
    tx.alqConcepto.count.mockResolvedValue(1);
    await expect(servicio.anularBoleta(CTX, 'b1', 'cargada dos veces')).rejects.toThrow(
      /ya se cobró o se liquidó/,
    );
    expect(tx.alqBoleta.update).not.toHaveBeenCalled();
  });

  it('anular una póliza: solo las cuotas sin pagar y sin nada cobrado; lo pagado queda', async () => {
    const { tx, servicio } = armar();
    tx.alqPoliza.findUnique.mockResolvedValue({
      anuladoEn: null,
      contratoId: C5,
      aseguradora: 'Sancor',
      boletas: [{ id: 'b2' }, { id: 'b3' }],
    });
    tx.alqConcepto.findMany.mockResolvedValue([{ claveGeneracion: `bol|b2|c|${INQ}` }]);
    const r = await servicio.anularPoliza(CTX, 'p1', 'se dio de baja');
    expect(r.cuotasAnuladas).toBe(1);
    expect(tx.alqBoleta.updateMany.mock.calls[0]![0].where).toEqual({ id: { in: ['b3'] } });
  });

  it('«Copiar el mes anterior» propone la cuota siguiente', () => {
    expect(cuotaSiguiente('3/6')).toBe('4/6');
    expect(cuotaSiguiente('6/6')).toBeNull();
    expect(cuotaSiguiente(null)).toBeNull();
  });
});
