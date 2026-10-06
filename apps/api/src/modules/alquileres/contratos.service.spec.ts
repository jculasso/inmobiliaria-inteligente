import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ContratoInputSchema } from '@vacker/types';
import { generarTramos } from '@vacker/domain';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { ContratosService } from './contratos.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const PROP = '11111111-1111-4111-8111-111111111111';
const DUENO = '22222222-2222-4222-8222-222222222222';
const INQ = '33333333-3333-4333-8333-333333333333';

/** Un contrato como el #25 de Gexion: ICL, 4 meses, del 01/11/2024 al 31/10/2026. */
function contrato(cambios: Record<string, unknown> = {}) {
  const tramos = generarTramos('2024-11-01', '2026-10-31', 4).map((t) => ({ ...t, importe: t.numero === 1 ? 250_000 : null }));
  return ContratoInputSchema.parse({
    propiedadId: PROP,
    inicio: '2024-11-01',
    fin: '2026-10-31',
    ajuste: 'indexado',
    indice: 'ICL',
    periodicidadMeses: 4,
    honorariosPct: 2.48,
    gastosAdmPct: 2,
    partes: [
      { personaId: DUENO, papel: 'propietario' },
      { personaId: INQ, papel: 'inquilino' },
    ],
    tramos,
    ...cambios,
  });
}

/** Una fila de contrato como la devuelve Prisma, para lo que se lee después de escribir. */
function fila(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    codigo: '1',
    estado: 'borrador',
    tipo: 'vivienda',
    moneda: 'ARS',
    inicio: new Date('2024-11-01'),
    fin: new Date('2026-10-31'),
    fechaFirma: null,
    diaVencimiento: 5,
    diaPagoPropietario: 10,
    ajuste: 'indexado',
    indice: 'ICL',
    periodicidadMeses: 4,
    honorariosPct: 2.48,
    gastosAdmPct: 2,
    ivaPct: 0,
    punitorioDiarioPct: 0,
    pagoGarantizado: false,
    depositoImporte: null,
    depositoMoneda: null,
    depositoDevolucion: null,
    rescindidoEl: null,
    obs: null,
    propiedad: { id: PROP, direccion: 'Calle 1', unidad: null, ciudad: null },
    partes: [],
    tramos: [],
    ...over,
  };
}

/** Lo que el servicio le pasa a Prisma, con lo que los tests miran. */
interface Datos {
  estado?: string;
  partes: { create: { papel: string; porcentaje: number | null }[] };
  [campo: string]: unknown;
}

function makeTx(over: { contratos?: unknown[]; personas?: number; propiedad?: unknown; existente?: unknown } = {}) {
  return {
    alqContrato: {
      findMany: vi.fn().mockResolvedValue(over.contratos ?? []),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(over.existente ?? fila()),
      create: vi.fn(async (_args: { data: Datos }) => fila()),
      // Solo el estado: las relaciones anidadas (`partes: { create }`) no son filas.
      update: vi.fn(async (args: { data: Datos }) => fila({ estado: args.data.estado ?? 'borrador' })),
    },
    alqPropiedad: { findUnique: vi.fn().mockResolvedValue(over.propiedad === undefined ? { id: PROP } : over.propiedad) },
    alqPersona: { count: vi.fn().mockResolvedValue(over.personas ?? 2) },
    alqContratoParte: { deleteMany: vi.fn() },
    alqTramo: { deleteMany: vi.fn() },
    alqConcepto: { updateMany: vi.fn() },
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

describe('ContratosService.crear', () => {
  it('nace en borrador, con el siguiente código libre y el tenant del usuario', async () => {
    const tx = makeTx({ contratos: [{ codigo: '24' }, { codigo: '25' }, { codigo: 'VIEJO-3' }] });
    await new ContratosService(makeDb(tx)).crear(CTX, contrato());
    const data = tx.alqContrato.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ codigo: '26', estado: 'borrador', tenantId: 't1' });
  });

  it('un único propietario sin porcentaje queda con el 100%', async () => {
    const tx = makeTx();
    await new ContratosService(makeDb(tx)).crear(CTX, contrato());
    const partes = tx.alqContrato.create.mock.calls[0]![0].data.partes.create;
    expect(partes.find((p) => p.papel === 'propietario')?.porcentaje).toBe(100);
  });

  // Regla 1: un hueco entre tramos no se guarda, y el mensaje dice dónde.
  it('rechaza tramos con un hueco, nombrando las fechas', async () => {
    const dto = contrato();
    dto.tramos[1] = { ...dto.tramos[1]!, desde: '2025-03-15' };
    const tx = makeTx();
    await expect(new ContratosService(makeDb(tx)).crear(CTX, dto)).rejects.toThrow(/Del 01\/03\/2025 al 14\/03\/2025 no hay tramo/);
    expect(tx.alqContrato.create).not.toHaveBeenCalled();
  });

  // Regla 4.
  it('rechaza propietarios cuyos porcentajes no suman 100', async () => {
    const OTRO = '44444444-4444-4444-8444-444444444444';
    const dto = contrato({
      partes: [
        { personaId: DUENO, papel: 'propietario', porcentaje: 50 },
        { personaId: OTRO, papel: 'propietario', porcentaje: 40 },
        { personaId: INQ, papel: 'inquilino' },
      ],
    });
    await expect(new ContratosService(makeDb(makeTx({ personas: 3 }))).crear(CTX, dto)).rejects.toThrow(/suman 90%/);
  });

  // RLS oculta las de otra inmobiliaria: para nosotros no existen.
  it('rechaza una persona o una propiedad que no existen en la inmobiliaria', async () => {
    await expect(new ContratosService(makeDb(makeTx({ personas: 1 }))).crear(CTX, contrato())).rejects.toThrow(/personas no existe/);
    await expect(new ContratosService(makeDb(makeTx({ propiedad: null }))).crear(CTX, contrato())).rejects.toThrow(/propiedad no existe/);
  });

  it('un código repetido se rechaza con el código en el mensaje', async () => {
    const tx = makeTx();
    tx.alqContrato.findFirst.mockResolvedValue({ id: 'otro' });
    await expect(new ContratosService(makeDb(tx)).crear(CTX, contrato({ codigo: '25' }))).rejects.toThrow(ConflictException);
  });

  it('un contrato escalonado no guarda índice aunque venga', async () => {
    const tx = makeTx();
    const tramos = generarTramos('2024-11-01', '2026-10-31', 4).map((t) => ({ ...t, importe: 300_000 }));
    await new ContratosService(makeDb(tx)).crear(CTX, contrato({ ajuste: 'escalonado', tramos }));
    expect(tx.alqContrato.create.mock.calls[0]![0].data).toMatchObject({ indice: null, periodicidadMeses: null });
  });
});

describe('ContratosService.actualizar', () => {
  it('un contrato vigente no se edita completo', async () => {
    const tx = makeTx({ existente: fila({ estado: 'vigente' }) });
    await expect(new ContratosService(makeDb(tx)).actualizar(CTX, 'c1', contrato())).rejects.toThrow(BadRequestException);
    expect(tx.alqContrato.update).not.toHaveBeenCalled();
  });

  it('en borrador reemplaza partes y tramos', async () => {
    const tx = makeTx();
    await new ContratosService(makeDb(tx)).actualizar(CTX, 'c1', contrato());
    expect(tx.alqContratoParte.deleteMany).toHaveBeenCalledWith({ where: { contratoId: 'c1' } });
    expect(tx.alqTramo.deleteMany).toHaveBeenCalledWith({ where: { contratoId: 'c1' } });
  });
});

describe('ContratosService.cambiarEstado (reglas 2 y 3)', () => {
  it('borrador → vigente', async () => {
    const tx = makeTx();
    await new ContratosService(makeDb(tx)).cambiarEstado(CTX, 'c1', { estado: 'vigente' });
    expect(tx.alqContrato.update.mock.calls[0]![0].data).toMatchObject({ estado: 'vigente' });
  });

  it('borrador no puede pasar a finalizado ni a rescindido', async () => {
    const svc = new ContratosService(makeDb(makeTx()));
    await expect(svc.cambiarEstado(CTX, 'c1', { estado: 'finalizado' })).rejects.toThrow(/borrador no puede pasar a finalizado/);
    await expect(svc.cambiarEstado(CTX, 'c1', { estado: 'rescindido', fecha: '2025-06-30' })).rejects.toThrow(BadRequestException);
  });

  it('rescindir anula lo generado de meses posteriores que no se cobró', async () => {
    const tx = makeTx({ existente: fila({ estado: 'vigente' }) });
    await new ContratosService(makeDb(tx)).cambiarEstado(CTX, 'c1', { estado: 'rescindido', fecha: '2025-06-30' });
    expect(tx.alqConcepto.updateMany).toHaveBeenCalledWith({
      where: { contratoId: 'c1', anuladoEn: null, periodo: { gt: '2025-06' }, imputaciones: { none: { cobro: { anuladoEn: null }, registradaEnCobro: { anuladoEn: null } } } },
      data: expect.objectContaining({ motivoAnulacion: 'rescisión', anuladoPorId: 'u1' }),
    });
    expect(tx.alqContrato.update.mock.calls[0]![0].data).toMatchObject({ estado: 'rescindido' });
  });

  it('la fecha de rescisión tiene que estar dentro del contrato', async () => {
    const tx = makeTx({ existente: fila({ estado: 'vigente' }) });
    await expect(new ContratosService(makeDb(tx)).cambiarEstado(CTX, 'c1', { estado: 'rescindido', fecha: '2030-01-01' })).rejects.toThrow(
      /dentro del contrato/,
    );
    expect(tx.alqConcepto.updateMany).not.toHaveBeenCalled();
  });

  it('un contrato finalizado ya no cambia', async () => {
    const tx = makeTx({ existente: fila({ estado: 'finalizado' }) });
    await expect(new ContratosService(makeDb(tx)).cambiarEstado(CTX, 'c1', { estado: 'vigente' })).rejects.toThrow(BadRequestException);
  });
});

describe('ContratosService.listar', () => {
  it('el importe de hoy y la próxima indexación salen de los tramos', async () => {
    const hoy = new Date();
    const dia = (n: number) => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + n));
    const tx = makeTx({
      contratos: [
        fila({
          estado: 'vigente',
          tramos: [
            { numero: 1, desde: dia(-60), hasta: dia(30), importe: 250_000 },
            { numero: 2, desde: dia(31), hasta: dia(120), importe: null },
          ],
        }),
      ],
    });
    const [c] = await new ContratosService(makeDb(tx)).listar();
    expect(c!.importeVigente).toBe(250_000);
    expect(c!.proximaIndexacion).toBe(dia(31).toISOString().slice(0, 10));
  });
});
