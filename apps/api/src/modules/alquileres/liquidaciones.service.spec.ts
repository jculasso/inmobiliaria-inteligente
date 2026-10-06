import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LiquidacionInputSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { LiquidacionesService } from './liquidaciones.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const DUENO = '11111111-1111-4111-8111-111111111111';
const INQ = '22222222-2222-4222-8222-222222222222';
const dec = (n: number) => new Prisma.Decimal(n);
const PARTE = 'alq|c5|2026-11|2026-11-01';
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

const C5 = '55555555-5555-4555-8555-555555555555';
const contrato = (pagoGarantizado = false) => ({ id: C5, codigo: '5', pagoGarantizado, partes: [{ personaId: DUENO }] });

/* Noviembre de 2026 del contrato #5, del lado del propietario. */
function delDueno(over: Record<string, unknown> = {}) {
  return {
    id: uuid(),
    personaId: DUENO,
    moneda: 'ARS',
    tipo: 'alquiler',
    sentido: 'a_pagar',
    importe: dec(1_137_518),
    claveGeneracion: `${PARTE}|alquiler|a_pagar|${DUENO}`,
    descripcion: 'Alquiler noviembre 2026',
    contrato: contrato(),
    imputaciones: [] as { importe: Prisma.Decimal }[],
    ...over,
  };
}
const honorarios = () => delDueno({ tipo: 'honorarios', sentido: 'a_cobrar', importe: dec(110_111.74), claveGeneracion: `${PARTE}|honorarios|a_cobrar|${DUENO}`, descripcion: 'Honorarios noviembre 2026' });
const alquilerDelInquilino = (pagado: number) => ({
  tipo: 'alquiler',
  importe: dec(1_137_518),
  claveGeneracion: `${PARTE}|alquiler|a_cobrar|${INQ}`,
  imputaciones: pagado ? [{ importe: dec(pagado) }] : [],
});

function makeTx(over: { delDueno?: unknown[]; delInquilino?: unknown[]; marcados?: number } = {}) {
  const deDueno = over.delDueno ?? [delDueno(), honorarios()];
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    alqPersona: {
      findUnique: vi.fn().mockResolvedValue({ id: DUENO, nombre: 'Propietario' }),
      findMany: vi.fn().mockResolvedValue([{ id: DUENO, nombre: 'Propietario' }]),
    },
    alqConcepto: {
      // La primera consulta trae lo del propietario; la segunda, lo del inquilino de esos contratos.
      findMany: vi.fn(async (args: { where: { contratoId?: unknown } }) =>
        args.where.contratoId && typeof args.where.contratoId === 'object' && 'in' in (args.where.contratoId as object)
          ? (over.delInquilino ?? [alquilerDelInquilino(1_137_518)])
          : deDueno,
      ),
      updateMany: vi.fn(async (args: { where: { id?: { in: string[] } } }) => ({ count: over.marcados ?? args.where.id?.in.length ?? 0 })),
    },
    alqLiquidacion: {
      aggregate: vi.fn().mockResolvedValue({ _max: { numero: 2 } }),
      create: vi.fn().mockResolvedValue({ id: 'liq' }),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function makeDb(tx: ReturnType<typeof makeTx>): TenantPrismaService {
  // `obtenerEn` relee lo creado: devolvemos lo que se guardó.
  tx.alqLiquidacion.findUnique.mockImplementation(async () => {
    const data = tx.alqLiquidacion.create.mock.calls[0]?.[0].data;
    return {
      id: 'liq',
      numero: data?.numero ?? 3,
      persona: { id: DUENO, nombre: 'Propietario' },
      fecha: new Date('2026-11-12T00:00:00Z'),
      moneda: 'ARS',
      medio: 'transferencia',
      detalle: data?.detalle ?? { aPagar: [], aDescontar: [] },
      neto: dec(data?.neto ?? 0),
      anuladoEn: null,
      motivoAnulacion: null,
    };
  });
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

const input = (over: Record<string, unknown> = {}) => LiquidacionInputSchema.parse({ personaId: DUENO, fecha: '2026-11-12', ...over });

describe('LiquidacionesService (reglas 20 a 22)', () => {
  // Regla 20, con los números del contrato #5.
  it('inquilino al día: liquida el alquiler menos los honorarios', async () => {
    const tx = makeTx();
    const r = await new LiquidacionesService(makeDb(tx)).liquidar(CTX, input());
    expect(r).toMatchObject({ numero: 3, neto: 1_027_406.26 });
    expect(r.aPagar.map((x) => x.importe)).toEqual([1_137_518]);
    expect(r.aDescontar.map((x) => x.importe)).toEqual([110_111.74]);
    expect(tx.alqLiquidacion.create.mock.calls[0]![0].data).toMatchObject({ tenantId: 't1', periodo: '2026-11', creadoPorId: 'u1' });
  });

  // Regla 20: cada concepto se liquida una sola vez.
  it('marca los conceptos solo si siguen sin liquidar, y si alguno cambió deshace todo', async () => {
    const tx = makeTx({ marcados: 1 });
    await expect(new LiquidacionesService(makeDb(tx)).liquidar(CTX, input())).rejects.toThrow(ConflictException);
    expect(tx.alqConcepto.updateMany.mock.calls[0]![0].where).toMatchObject({ liquidacionId: null, anuladoEn: null });
  });

  // Regla 22.
  it('sin pago del inquilino no hay nada para liquidar: alquiler y honorarios esperan', async () => {
    const tx = makeTx({ delInquilino: [alquilerDelInquilino(0)] });
    const svc = new LiquidacionesService(makeDb(tx));
    const prep = await svc.preparar(DUENO, 'ARS', '2026-11-12');
    expect(prep.enEspera.map((x) => x.tipo)).toEqual(['alquiler', 'honorarios']);
    await expect(svc.liquidar(CTX, input())).rejects.toThrow(/espera a que paguen los inquilinos/);
  });

  it('un pago parcial del inquilino todavía no libera el alquiler', async () => {
    const prep = await new LiquidacionesService(makeDb(makeTx({ delInquilino: [alquilerDelInquilino(1_000_000)] }))).preparar(DUENO, 'ARS', '2026-11-12');
    expect(prep.aPagar).toEqual([]);
  });

  // Regla 21.
  it('con pago garantizado se liquida aunque el inquilino no haya pagado', async () => {
    const tx = makeTx({ delDueno: [delDueno({ contrato: contrato(true) }), honorarios()], delInquilino: [alquilerDelInquilino(0)] });
    const prep = await new LiquidacionesService(makeDb(tx)).preparar(DUENO, 'ARS', '2026-11-12');
    expect(prep.neto).toBe(1_027_406.26);
  });

  it('dejar un alquiler para después deja también sus honorarios', async () => {
    const alq = delDueno();
    const tx = makeTx({ delDueno: [alq, honorarios()] });
    await expect(new LiquidacionesService(makeDb(tx)).liquidar(CTX, input({ excluidos: [alq.id] }))).rejects.toThrow(BadRequestException);
  });

  it('si los descuentos superan lo que se le paga, pide dejar alguno para la próxima', async () => {
    const reparacion = delDueno({ tipo: 'reparacion', sentido: 'a_cobrar', importe: dec(2_000_000), claveGeneracion: null, descripcion: 'Reparación' });
    const tx = makeTx({ delDueno: [delDueno(), honorarios(), reparacion] });
    await expect(new LiquidacionesService(makeDb(tx)).liquidar(CTX, input())).rejects.toThrow(/supera lo que se le paga/);
  });

  // Quien es propietario de un contrato e inquilino de otro: su alquiler de inquilino no se descuenta.
  it('solo cuenta lo de los contratos donde la persona es propietaria', async () => {
    const comoInquilino = delDueno({ tipo: 'reparacion', sentido: 'a_cobrar', importe: dec(5_000), claveGeneracion: null, contrato: { ...contrato(), id: 'c9', partes: [{ personaId: 'otro' }] } });
    const prep = await new LiquidacionesService(makeDb(makeTx({ delDueno: [delDueno(), honorarios(), comoInquilino] }))).preparar(DUENO, 'ARS', '2026-11-12');
    expect(prep.aDescontar.map((x) => x.tipo)).toEqual(['honorarios']);
  });

  // Regla 19: anular suelta los conceptos; el detalle guardado queda.
  it('anular suelta los conceptos para volver a liquidarlos', async () => {
    const tx = makeTx();
    await new LiquidacionesService(makeDb(tx)).anular(CTX, 'liq', 'Se transfirió a otra cuenta');
    expect(tx.alqLiquidacion.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: 'liq', anuladoEn: null }, data: { motivoAnulacion: 'Se transfirió a otra cuenta' } });
    expect(tx.alqConcepto.updateMany).toHaveBeenCalledWith({ where: { liquidacionId: 'liq' }, data: { liquidacionId: null } });
  });

  it('la bandeja lista a quién hay que liquidar y lo que le espera', async () => {
    const r = await new LiquidacionesService(makeDb(makeTx())).pendientes();
    expect(r).toEqual([{ persona: { id: DUENO, nombre: 'Propietario' }, moneda: 'ARS', neto: 1_027_406.26, enEspera: 0 }]);
  });

  // La trampa de performance.
  it('las mismas consultas con 5 conceptos y con 25', async () => {
    const consultas = async (k: number) => {
      const tx = makeTx({ delDueno: Array.from({ length: k }, () => delDueno()) });
      await new LiquidacionesService(makeDb(tx)).liquidar(CTX, input());
      return tx.alqConcepto.findMany.mock.calls.length + tx.alqConcepto.updateMany.mock.calls.length + tx.alqLiquidacion.create.mock.calls.length;
    };
    expect(await consultas(5)).toBe(await consultas(25));
  });
});
