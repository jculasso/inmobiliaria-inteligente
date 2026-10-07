import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ComprobanteInputSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { ProveedoresService } from './proveedores.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const PROV = '77777777-7777-4777-8777-777777777777';
const C5 = '55555555-5555-4555-8555-555555555555';
const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '12121212-1212-4121-8121-121212121212';
const INQ = '22222222-2222-4222-8222-222222222222';
const RECLAMO = '33333333-3333-4333-8333-333333333333';

function armar(over: { aplicados?: number } = {}) {
  const tx = {
    ...mocksDeHistorial(),
    alqProveedor: {
      findUnique: vi.fn().mockResolvedValue({ nombre: 'Juan Plomero', rubro: 'plomero' }),
    },
    alqContrato: {
      findUnique: vi.fn().mockResolvedValue({
        codigo: 'ALT-0005',
        estado: 'vigente',
        partes: [
          { personaId: D1, papel: 'propietario', porcentaje: new Prisma.Decimal(60) },
          { personaId: D2, papel: 'propietario', porcentaje: new Prisma.Decimal(40) },
          { personaId: INQ, papel: 'inquilino', porcentaje: null },
        ],
      }),
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: C5, codigo: 'ALT-0005', propiedad: { direccion: 'Mendoza 3340', unidad: null } },
        ]),
    },
    alqComprobante: {
      create: vi.fn(),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        proveedor: { id: PROV, nombre: 'Juan Plomero', rubro: 'plomero' },
        proveedorId: PROV,
        contratoId: C5,
        fecha: new Date('2026-10-06T00:00:00Z'),
        tipoComprobante: 'factura_c',
        numero: null,
        descripcion: 'Cambio de flexible',
        importe: new Prisma.Decimal(85_000),
        moneda: 'ARS',
        aCargoDe: 'propietario',
        pagadoEl: null,
        medio: null,
        creadoPorId: 'u1',
        anuladoEn: null,
        reclamo: null as { id: string; numero: number } | null,
      })),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    alqReclamo: {
      findUnique: vi.fn().mockResolvedValue({ numero: 7, contratoId: C5 }),
      update: vi.fn(),
    },
    alqReclamoNota: { create: vi.fn() },
    alqConcepto: {
      createMany: vi.fn(),
      count: vi.fn().mockResolvedValue(over.aplicados ?? 0),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  return { tx, servicio: new ProveedoresService(db) };
}

const comprobante = (over: Record<string, unknown> = {}) =>
  ComprobanteInputSchema.parse({
    proveedorId: PROV,
    contratoId: C5,
    fecha: '2026-10-06',
    descripcion: 'Cambio de flexible',
    importe: 85_000,
    ...over,
  });

describe('ProveedoresService (entrega 18: «les paga la inmobiliaria y se lo retiene al propietario»)', () => {
  it('a cargo del propietario: concepto adelantado, repartido por porcentaje, que se descuenta en la liquidación', async () => {
    const { tx, servicio } = armar();
    await servicio.cargarComprobante(CTX, comprobante());
    expect(
      tx.alqConcepto.createMany.mock.calls[0]![0].data.map(
        (k: {
          personaId: string;
          importe: number;
          adelantadoPorInmobiliaria: boolean;
          tipo: string;
        }) => [k.personaId, k.importe, k.adelantadoPorInmobiliaria, k.tipo],
      ),
    ).toEqual([
      [D1, 51_000, true, 'reparacion'],
      [D2, 34_000, true, 'reparacion'],
    ]);
    expect(tx.alqConcepto.createMany.mock.calls[0]![0].data[0].descripcion).toBe(
      'Plomero: Cambio de flexible (Juan Plomero)',
    );
  });

  it('a cargo del inquilino: se le cobra a él', async () => {
    const { tx, servicio } = armar();
    await servicio.cargarComprobante(CTX, comprobante({ aCargoDe: 'inquilino' }));
    expect(tx.alqConcepto.createMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({
        personaId: INQ,
        importe: 85_000,
        adelantadoPorInmobiliaria: false,
      }),
    ]);
  });

  it('gasto de la inmobiliaria: no le carga nada a nadie', async () => {
    const { tx, servicio } = armar();
    await servicio.cargarComprobante(
      CTX,
      comprobante({ aCargoDe: 'inmobiliaria', contratoId: null, pagado: true }),
    );
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
    expect(tx.alqComprobante.create.mock.calls[0]![0].data).toMatchObject({
      pagadoPorId: 'u1',
      medio: 'transferencia',
    });
  });

  it('si lo cargado ya se liquidó, no se anula', async () => {
    const { tx, servicio } = armar({ aplicados: 1 });
    await expect(servicio.anular(CTX, 'x', 'Error de carga')).rejects.toThrow(
      /ya se cobró o se liquidó/,
    );
    expect(tx.alqComprobante.update).not.toHaveBeenCalled();
  });

  it('el comprobante a cargo de una parte necesita el contrato', () => {
    expect(
      ComprobanteInputSchema.safeParse({
        proveedorId: PROV,
        fecha: '2026-10-06',
        descripcion: 'Pintura',
        importe: 1,
        aCargoDe: 'propietario',
      }).success,
    ).toBe(false);
  });
});

// Javier, 7/10/2026: el gasto del arreglo se carga desde el reclamo y queda enlazado.
describe('ProveedoresService · el gasto del arreglo de un reclamo (reglas 70 a 72)', () => {
  it('regla 70: el comprobante queda enlazado al reclamo, y el historial del reclamo lo cuenta', async () => {
    const { tx, servicio } = armar();
    await servicio.cargarComprobante(CTX, comprobante({ reclamoId: RECLAMO }));
    expect(tx.alqComprobante.create.mock.calls[0]![0].data).toMatchObject({
      reclamoId: RECLAMO,
      contratoId: C5,
    });
    expect(tx.alqReclamoNota.create.mock.calls[0]![0].data).toMatchObject({
      reclamoId: RECLAMO,
      tenantId: 't1',
      texto: 'Gasto del arreglo: Juan Plomero, $ 85.000,00, a cargo del propietario.',
    });
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0].resumen).toContain('reclamo 7');
  });

  it('regla 70: un reclamo que no es de la inmobiliaria se rechaza, sin cargar nada', async () => {
    const { tx, servicio } = armar();
    tx.alqReclamo.findUnique.mockResolvedValueOnce(null);
    await expect(
      servicio.cargarComprobante(CTX, comprobante({ reclamoId: RECLAMO })),
    ).rejects.toThrow('El reclamo no existe.');
    expect(tx.alqComprobante.create).not.toHaveBeenCalled();
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
  });

  it('regla 70: el gasto del arreglo va al contrato del reclamo, no a otro', async () => {
    const { tx, servicio } = armar();
    tx.alqReclamo.findUnique.mockResolvedValueOnce({
      numero: 7,
      contratoId: '66666666-6666-4666-8666-666666666666',
    });
    await expect(
      servicio.cargarComprobante(CTX, comprobante({ reclamoId: RECLAMO })),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('otro contrato') });
    expect(tx.alqComprobante.create).not.toHaveBeenCalled();
  });

  it('regla 70: sin reclamo, el comprobante se carga como siempre', async () => {
    const { tx, servicio } = armar();
    await servicio.cargarComprobante(CTX, comprobante());
    expect(tx.alqComprobante.create.mock.calls[0]![0].data.reclamoId).toBeNull();
    expect(tx.alqReclamo.findUnique).not.toHaveBeenCalled();
    expect(tx.alqReclamoNota.create).not.toHaveBeenCalled();
  });

  it('regla 72: el comprobante dice de qué reclamo salió', async () => {
    const { tx, servicio } = armar();
    tx.alqComprobante.findUnique.mockImplementationOnce(async ({ where }) => ({
      ...(await armar().tx.alqComprobante.findUnique({ where })),
      reclamo: { id: RECLAMO, numero: 7 },
    }));
    const c = await servicio.cargarComprobante(CTX, comprobante({ reclamoId: RECLAMO }));
    expect(c.reclamo).toEqual({ id: RECLAMO, numero: 7 });
  });
});
