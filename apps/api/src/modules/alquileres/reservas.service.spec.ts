import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReservaInputSchema, type Contrato, type ReservaInput } from '@vacker/types';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { ContratosService } from './contratos.service';
import { mocksDeHistorial } from './historial.testing';
import { devolverReservaDelContrato } from './reserva-del-contrato';
import { ReservasService } from './reservas.service';

const CTX: TenantContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  roles: ['administracion'],
};
const PROPIEDAD = '33333333-3333-4333-8333-333333333333';
const ANA = '44444444-4444-4444-8444-444444444444';
const CARLOS = '55555555-5555-4555-8555-555555555555';
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const entrada = (over: Partial<ReservaInput> = {}) =>
  ReservaInputSchema.parse({
    propiedadId: PROPIEDAD,
    fecha: '2026-10-15',
    vence: '2026-10-22',
    partes: [
      { personaId: ANA, papel: 'inquilino' },
      { personaId: CARLOS, papel: 'garante' },
    ],
    senaImporte: 500,
    senaMoneda: 'USD',
    alquilerInicial: 600_000,
    inicio: '2026-11-01',
    duracionMeses: 24,
    ajuste: 'indexado',
    indice: 'ICL',
    periodicidadMeses: 3,
    depositoImporte: 600,
    depositoMoneda: 'USD',
    ...over,
  });

/** Una reserva como la lee la ficha. */
function filaFicha(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    numero: 1,
    estado: 'reservada',
    propiedadId: PROPIEDAD,
    tipo: 'vivienda',
    fecha: d('2026-10-15'),
    vence: d('2026-10-22'),
    senaImporte: new Prisma.Decimal(500),
    senaMoneda: 'USD',
    // La seña todavía sin cobrar; `conSena()` la cobra (regla 169).
    conceptos: [],
    moneda: 'ARS',
    alquilerInicial: new Prisma.Decimal(600_000),
    inicio: d('2026-11-01'),
    duracionMeses: 24,
    ajuste: 'indexado',
    indice: 'ICL',
    periodicidadMeses: 3,
    depositoImporte: new Prisma.Decimal(600),
    depositoMoneda: 'USD',
    obs: null,
    motivo: null,
    creadoPorId: CTX.userId,
    createdAt: new Date('2026-10-15T13:00:00Z'),
    propiedad: { id: PROPIEDAD, direccion: 'Mitre 100', unidad: '2° A', ciudad: 'Rosario' },
    partes: [
      { personaId: ANA, papel: 'inquilino', persona: { nombre: 'Ana Interesada' } },
      { personaId: CARLOS, papel: 'garante', persona: { nombre: 'Carlos Garante' } },
    ],
    contrato: null,
    garantias: [],
    ...over,
  };
}

/** La seña cobrada: su concepto con el recibo 000123 (regla 169). */
const SENA_COBRADA = {
  id: 'k-sena',
  sentido: 'a_cobrar',
  importe: new Prisma.Decimal(500),
  moneda: 'USD',
  personaId: ANA,
  contratoId: null,
  cobro: { id: 'c-sena', numero: 123, fecha: d('2026-10-15'), medio: 'transferencia' },
};
const conSena = (over: Record<string, unknown> = {}) =>
  filaFicha({ conceptos: [SENA_COBRADA], ...over });

function garantia(estado: string) {
  return {
    id: `g-${estado}-${Math.random()}`,
    tipo: 'propietaria',
    personaId: CARLOS,
    garante: null,
    detalle: 'Mendoza 900',
    estado,
    aprobadaEl: estado === 'aprobada' ? d('2026-10-16') : null,
    obs: null,
    createdAt: new Date(),
  };
}

function servicio(
  over: {
    actual?: Record<string, unknown> | null;
    otraAbierta?: { numero: number } | null;
    garantias?: ReturnType<typeof garantia>[];
    personas?: number;
    lista?: Record<string, unknown>[];
    config?: Record<string, unknown>;
  } = {},
) {
  const actual = over.actual === undefined ? filaFicha() : over.actual;
  const tx = {
    ...mocksDeHistorial(),
    alqReserva: {
      findMany: vi.fn().mockResolvedValue(over.lista ?? [filaFicha()]),
      findUnique: vi.fn().mockResolvedValue(actual),
      findFirst: vi.fn().mockResolvedValue(over.otraAbierta ?? null),
      aggregate: vi.fn().mockResolvedValue({ _max: { numero: 6 } }),
      create: vi.fn().mockResolvedValue({ id: 'r1' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    alqReservaParte: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      create: vi.fn().mockResolvedValue({}),
    },
    // La seña: su concepto, su recibo y la imputación (reglas 169 a 171).
    alqConcepto: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    alqCobro: {
      aggregate: vi.fn().mockResolvedValue({ _max: { numero: 122 } }),
      create: vi.fn().mockResolvedValue({}),
    },
    alqImputacion: { create: vi.fn().mockResolvedValue({}) },
    tenant: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ config: over.config ?? { ivaHonorariosPct: 21 } }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    alqPropiedad: {
      findUnique: vi.fn().mockResolvedValue({ direccion: 'Mitre 100', unidad: '2° A' }),
    },
    alqPersona: {
      count: vi.fn().mockResolvedValue(over.personas ?? 2),
      findUnique: vi.fn().mockResolvedValue({ nombre: 'Carlos Garante' }),
    },
    alqGarantia: {
      findMany: vi.fn().mockResolvedValue(over.garantias ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  // El historial de la ficha: `alq_evento` también responde a `findMany`.
  Object.assign(tx.alqEvento, {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 'e1',
        en: new Date('2026-10-15T13:00:00Z'),
        usuarioNombre: 'Lucía Operadora',
        entidad: 'reserva',
        accion: 'alta',
        resumen: 'Reserva 1: Mitre 100 2° A, reservada',
      },
    ]),
  });
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  const contratos = {
    // Como el de verdad: corre lo de la reserva en la transacción del alta.
    crear: vi.fn(
      async (
        _ctx: TenantContext,
        _dto: Contrato,
        enLaMismaTransaccion?: (t: never, id: string, codigo: string) => Promise<void>,
      ) => {
        await enLaMismaTransaccion?.(tx as never, 'k1', 'ALT-0012');
        return { id: 'k1', codigo: 'ALT-0012' };
      },
    ),
  };
  const s = new ReservasService(db, contratos as unknown as ContratosService);
  /** Todas las llamadas a la base que hizo el servicio. */
  const consultas = () =>
    Object.values(tx)
      .flatMap((modelo) => Object.values(modelo as Record<string, { mock?: { calls: unknown[] } }>))
      .reduce((n, f) => n + (f.mock?.calls.length ?? 0), 0);
  return { s, tx, contratos, consultas };
}

const contrato = (over: Partial<Contrato> = {}) =>
  ({ propiedadId: PROPIEDAD, ...over }) as unknown as Contrato;

describe('ReservasService · alta (reglas 154 y 156)', () => {
  it('regla 154: le da el número siguiente de la inmobiliaria, con sus partes y la seña', async () => {
    const { s, tx } = servicio();
    await s.crear(CTX, entrada());
    const { data } = tx.alqReserva.create.mock.calls[0]![0] as {
      data: Record<string, unknown> & { partes: { create: unknown[] } };
    };
    expect(data).toMatchObject({
      numero: 7,
      tenantId: CTX.tenantId,
      creadoPorId: CTX.userId,
      propiedadId: PROPIEDAD,
      senaImporte: 500,
      senaMoneda: 'USD',
      depositoMoneda: 'USD',
    });
    expect(data.partes.create).toEqual([
      { tenantId: CTX.tenantId, personaId: ANA, papel: 'inquilino' },
      { tenantId: CTX.tenantId, personaId: CARLOS, papel: 'garante' },
    ]);
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'reserva',
      entidadId: 'r1',
      accion: 'alta',
      resumen: 'Reserva 7: Mitre 100 2° A, reservada',
    });
  });

  it('regla 156: una propiedad con una reserva abierta no admite otra (409, con el número)', async () => {
    const { s, tx } = servicio({ otraAbierta: { numero: 3 } });
    await expect(s.crear(CTX, entrada())).rejects.toThrow(
      new ConflictException('Mitre 100 2° A ya tiene abierta la reserva 3.'),
    );
    expect(tx.alqReserva.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propiedadId: PROPIEDAD, estado: { in: ['reservada', 'en_estudio', 'aprobada'] } },
      }),
    );
    expect(tx.alqReserva.create).not.toHaveBeenCalled();
  });

  it('una persona de otra inmobiliaria (o que no existe) no entra', async () => {
    const { s, tx } = servicio({ personas: 1 });
    await expect(s.crear(CTX, entrada())).rejects.toThrow('Alguna persona no existe.');
    expect(tx.alqReserva.create).not.toHaveBeenCalled();
  });
});

describe('ReservasService · pasos (reglas 155, 157 y 158)', () => {
  it('regla 155: reservada → en estudio, y el paso queda en la línea de tiempo con quién', async () => {
    const { s, tx } = servicio();
    const dto = await s.cambiarEstado(CTX, 'r1', { estado: 'en_estudio' }, '2026-10-16');
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'en_estudio' },
    });
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'reserva',
      accion: 'estado',
      usuarioNombre: 'Lucía Operadora',
      resumen: 'Reserva 1: en estudio de garantías',
    });
    expect(dto.historial[0]).toMatchObject({ usuario: 'Lucía Operadora', entidad: 'reserva' });
  });

  it.each([
    ['reservada', 'aprobada', 'Una reserva reservada no pasa a aprobada.'],
    ['reservada', 'rechazada', 'Una reserva reservada no pasa a rechazada.'],
    ['aprobada', 'en_estudio', 'Una reserva aprobada no pasa a en estudio de garantías.'],
    ['convertida', 'anulada', 'Una reserva convertida en contrato no pasa a anulada.'],
    ['anulada', 'en_estudio', 'Una reserva anulada no pasa a en estudio de garantías.'],
    ['vencida', 'en_estudio', 'Una reserva vencida no pasa a en estudio de garantías.'],
  ] as const)('regla 155: %s → %s no es un paso', async (desde, hacia, mensaje) => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: desde }) });
    const cambio =
      hacia === 'rechazada' || hacia === 'anulada'
        ? { estado: hacia, motivo: 'Lo que sea' }
        : { estado: hacia };
    await expect(s.cambiarEstado(CTX, 'r1', cambio, '2026-10-30')).rejects.toThrow(
      new BadRequestException(mensaje),
    );
    expect(tx.alqReserva.update).not.toHaveBeenCalled();
  });

  it('regla 155: rechazar guarda el motivo y lo deja en el historial', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'en_estudio' }) });
    await s.cambiarEstado(
      CTX,
      'r1',
      { estado: 'rechazada', motivo: 'El garante no tiene ingresos demostrables' },
      '2026-10-16',
    );
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'rechazada', motivo: 'El garante no tiene ingresos demostrables' },
    });
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      resumen: 'Reserva 1: rechazada. Motivo: El garante no tiene ingresos demostrables',
      detalle: { motivo: 'El garante no tiene ingresos demostrables' },
    });
  });

  it('regla 157: aprobar con una garantía pendiente dice de quién falta el informe', async () => {
    const { s, tx } = servicio({
      actual: filaFicha({ estado: 'en_estudio' }),
      garantias: [garantia('aprobada'), garantia('pendiente')],
    });
    await expect(s.cambiarEstado(CTX, 'r1', { estado: 'aprobada' }, '2026-10-16')).rejects.toThrow(
      'Para aprobar, cada garantía tiene que tener su informe: falta el de Carlos Garante.',
    );
    expect(tx.alqReserva.update).not.toHaveBeenCalled();
  });

  it('regla 157: aprobar sin ninguna garantía aprobada no se puede', async () => {
    const { s } = servicio({
      actual: filaFicha({ estado: 'en_estudio' }),
      garantias: [garantia('rechazada')],
    });
    await expect(s.cambiarEstado(CTX, 'r1', { estado: 'aprobada' }, '2026-10-16')).rejects.toThrow(
      'Para aprobar hace falta al menos una garantía aprobada.',
    );
  });

  it('regla 157: una rechazada no impide aprobar si hay otra aprobada', async () => {
    const { s, tx } = servicio({
      actual: filaFicha({ estado: 'en_estudio' }),
      garantias: [garantia('rechazada'), garantia('aprobada')],
    });
    await s.cambiarEstado(CTX, 'r1', { estado: 'aprobada' }, '2026-10-16');
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'aprobada' },
    });
  });

  it('regla 158: dar por vencida antes del vencimiento no se puede; después, sí', async () => {
    const { s, tx } = servicio();
    await expect(s.cambiarEstado(CTX, 'r1', { estado: 'vencida' }, '2026-10-22')).rejects.toThrow(
      'La reserva vence el 22/10/2026: todavía no venció. Si se cae antes, anulala con el motivo.',
    );
    await s.cambiarEstado(CTX, 'r1', { estado: 'vencida' }, '2026-10-23');
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'vencida' },
    });
  });

  it('regla 157: las garantías se cargan con el mismo modelo, apuntando a la reserva', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'en_estudio' }) });
    await s.guardarGarantias(CTX, 'r1', [
      {
        tipo: 'propietaria',
        personaId: CARLOS,
        garante: null,
        detalle: 'Mendoza 900',
        estado: 'aprobada',
        aprobadaEl: '2026-10-16',
        obs: 'Informe de dominio sin inhibiciones',
      },
    ]);
    expect(tx.alqGarantia.deleteMany).toHaveBeenCalledWith({ where: { reservaId: 'r1' } });
    expect(tx.alqGarantia.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      reservaId: 'r1',
      tenantId: CTX.tenantId,
      estado: 'aprobada',
      aprobadaEl: d('2026-10-16'),
    });
    expect(tx.alqGarantia.createMany.mock.calls[0]![0].data[0]).not.toHaveProperty('contratoId');
  });

  it('regla 157: con la reserva aprobada, las garantías ya no se tocan', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'aprobada' }) });
    await expect(s.guardarGarantias(CTX, 'r1', [])).rejects.toThrow(
      'La reserva está aprobada: las garantías se cargan antes de aprobarla.',
    );
    expect(tx.alqGarantia.deleteMany).not.toHaveBeenCalled();
  });

  it.each(['convertida', 'rechazada', 'vencida', 'anulada'])(
    'regla 158: una reserva %s ya no se edita',
    async (estado) => {
      const { s, tx } = servicio({ actual: filaFicha({ estado }) });
      await expect(s.actualizar(CTX, 'r1', entrada())).rejects.toThrow(/ya no se edita/);
      expect(tx.alqReserva.update).not.toHaveBeenCalled();
    },
  );

  it('regla 158: abierta se edita, y las partes se reemplazan', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'en_estudio' }) });
    await s.actualizar(CTX, 'r1', entrada({ vence: '2026-10-29' }));
    expect(tx.alqReservaParte.deleteMany).toHaveBeenCalledWith({ where: { reservaId: 'r1' } });
    expect(tx.alqReserva.update.mock.calls[0]![0]).toMatchObject({
      where: { id: 'r1' },
      data: { vence: d('2026-10-29') },
    });
    // La misma propiedad: no se busca «otra abierta», que sería ella misma.
    expect(tx.alqReserva.findFirst).not.toHaveBeenCalled();
  });
});

describe('ReservasService · convertir en contrato (reglas 159 y 161)', () => {
  it('regla 159: en la transacción del alta, convierte la reserva y copia las garantías aprobadas', async () => {
    const aprobada = garantia('aprobada');
    const { s, tx, contratos } = servicio({
      actual: filaFicha({ estado: 'aprobada' }),
      garantias: [aprobada],
    });
    const k = await s.convertir(CTX, 'r1', contrato());
    expect(k).toMatchObject({ id: 'k1' });
    expect(contratos.crear).toHaveBeenCalledWith(CTX, contrato(), expect.any(Function));
    expect(tx.alqReserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: 'aprobada' },
      data: { estado: 'convertida', contratoId: 'k1' },
    });
    // Solo las aprobadas, y COPIADAS: la de la reserva no se mueve.
    expect(tx.alqGarantia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reservaId: 'r1', estado: 'aprobada' } }),
    );
    expect(tx.alqGarantia.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      contratoId: 'k1',
      tenantId: CTX.tenantId,
      estado: 'aprobada',
    });
    expect(tx.alqGarantia.deleteMany).not.toHaveBeenCalled();
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'reserva',
      entidadId: 'r1',
      contratoId: 'k1',
      resumen: 'Reserva 1 convertida en el contrato ALT-0012',
    });
  });

  it.each(['reservada', 'en_estudio', 'convertida', 'anulada'])(
    'regla 159: una reserva %s no se convierte (y el contrato no queda)',
    async (estado) => {
      const { s, tx } = servicio({ actual: filaFicha({ estado }) });
      await expect(s.convertir(CTX, 'r1', contrato())).rejects.toBeInstanceOf(ConflictException);
      expect(tx.alqReserva.updateMany).not.toHaveBeenCalled();
    },
  );

  it('regla 159: el contrato tiene que ser de la propiedad de la reserva', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'aprobada' }) });
    await expect(
      s.convertir(CTX, 'r1', contrato({ propiedadId: '99999999-9999-4999-8999-999999999999' })),
    ).rejects.toThrow('El contrato tiene que ser de la propiedad de la reserva 1.');
    expect(tx.alqReserva.updateMany).not.toHaveBeenCalled();
  });

  it('regla 159: si otro pedido la convirtió en el medio, no se pisa', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'aprobada' }) });
    tx.alqReserva.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(s.convertir(CTX, 'r1', contrato())).rejects.toThrow(
      'La reserva 1 ya se convirtió.',
    );
    expect(tx.alqGarantia.createMany).not.toHaveBeenCalled();
  });

  it('regla 161: la reserva del contrato trae su seña, con su recibo', async () => {
    const { s, tx } = servicio({ actual: conSena() });
    expect(await s.delContrato('k1')).toEqual({
      reserva: {
        id: 'r1',
        numero: 1,
        sena: {
          importe: 500,
          moneda: 'USD',
          recibida: true,
          recibidaEl: '2026-10-15',
          medio: 'transferencia',
          recibo: { id: 'c-sena', numero: 123 },
        },
      },
    });
    expect(tx.alqReserva.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contratoId: 'k1' } }),
    );
  });

  it('regla 161: un contrato que no salió de una reserva no trae nada', async () => {
    const { s } = servicio({ actual: null });
    expect(await s.delContrato('k1')).toEqual({ reserva: null });
  });

  const convertida = (conceptos: unknown[] = [], estado = 'borrador') => ({
    id: 'r1',
    numero: 4,
    contrato: { codigo: 'ALT-0012', estado },
    conceptos,
  });

  it('regla 160: borrar el contrato en borrador devuelve la reserva a aprobada, con su seña', async () => {
    const { tx } = servicio({ actual: convertida() });
    const extra = { updateMany: vi.fn(), deleteMany: vi.fn() };
    Object.assign(tx.alqConcepto, extra);
    await devolverReservaDelContrato(tx as never, CTX, 'k1');
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'aprobada', contratoId: null },
    });
    // La seña que había pasado a ser el depósito vuelve a la reserva (regla 170).
    expect(extra.updateMany).toHaveBeenCalledWith({
      where: { reservaId: 'r1', contratoId: 'k1', tipo: 'sena' },
      data: { contratoId: null },
    });
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'reserva',
      entidadId: 'r1',
      resumen:
        'Reserva 4: se borró el contrato ALT-0012, que estaba en borrador; vuelve a aprobada',
    });
  });

  it('regla 160: el reintegro de lo que sobraba se deshace; si ya se usó, no se borra', async () => {
    const sinUsar = servicio({
      actual: convertida([{ id: 'reint', tipo: 'deposito', imputaciones: [] }]),
    });
    Object.assign(sinUsar.tx.alqConcepto, { updateMany: vi.fn(), deleteMany: vi.fn() });
    await devolverReservaDelContrato(sinUsar.tx as never, CTX, 'k1');
    expect(
      (sinUsar.tx.alqConcepto as unknown as { deleteMany: ReturnType<typeof vi.fn> }).deleteMany,
    ).toHaveBeenCalledWith({ where: { id: { in: ['reint'] } } });
    const usado = servicio({
      actual: convertida([{ id: 'reint', tipo: 'deposito', imputaciones: [{ id: 'i' }] }]),
    });
    await expect(devolverReservaDelContrato(usado.tx as never, CTX, 'k1')).rejects.toThrow(
      'El reintegro de la seña de la reserva 4 ya se usó en un cobro: anulá ese cobro primero.',
    );
  });

  it('regla 160: un contrato que no salió de una reserva, o que no está en borrador, no toca reservas', async () => {
    const { tx } = servicio({ actual: null });
    await devolverReservaDelContrato(tx as never, CTX, 'k1');
    expect(tx.alqReserva.update).not.toHaveBeenCalled();
    const vigente = servicio({ actual: convertida([], 'vigente') });
    await devolverReservaDelContrato(vigente.tx as never, CTX, 'k1');
    expect(vigente.tx.alqReserva.update).not.toHaveBeenCalled();
  });
});

const PAGO = { fecha: '2026-10-15', medio: 'transferencia', personaId: null, obs: null } as const;

describe('La seña: recibo, depósito y retención (reglas 169 a 172)', () => {
  it('regla 169: cobrarla da un recibo de Cobros, a nombre del interesado, que la cancela', async () => {
    const { s, tx } = servicio();
    await s.cobrarSena(CTX, 'r1', PAGO);
    // El mismo candado que Cobros: no se repiten números de recibo.
    expect(tx.$executeRaw).toHaveBeenCalled();
    const cobro = tx.alqCobro.create.mock.calls[0]![0].data;
    expect(cobro).toMatchObject({
      numero: 123,
      personaId: ANA,
      moneda: 'USD',
      importe: 500,
      medio: 'transferencia',
      fecha: d('2026-10-15'),
    });
    const concepto = tx.alqConcepto.create.mock.calls[0]![0].data;
    expect(concepto).toMatchObject({
      tipo: 'sena',
      sentido: 'a_cobrar',
      personaId: ANA,
      reservaId: 'r1',
      importe: 500,
      moneda: 'USD',
      cobroId: cobro.id,
      descripcion: 'Seña de la reserva 1 · Mitre 100 2° A',
    });
    expect(tx.alqImputacion.create.mock.calls[0]![0].data).toMatchObject({
      cobroId: cobro.id,
      conceptoId: concepto.id,
      registradaEnCobroId: cobro.id,
      importe: 500,
    });
    // En la línea de tiempo de la reserva y en el historial de la persona.
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({
        entidad: 'reserva',
        resumen: 'Reserva 1: Seña de U$S 500,00 cobrada: recibo 000123',
      }),
      expect.objectContaining({ entidad: 'cobro', personaId: ANA }),
    ]);
  });

  it('regla 169: una vez por recibo vigente; la paga un interesado; con la reserva abierta', async () => {
    const ya = servicio({ actual: conSena() });
    await expect(ya.s.cobrarSena(CTX, 'r1', PAGO)).rejects.toThrow(
      'La seña ya se cobró: recibo 000123.',
    );
    const otro = servicio();
    await expect(otro.s.cobrarSena(CTX, 'r1', { ...PAGO, personaId: CARLOS })).rejects.toThrow(
      'La seña la paga un interesado de la reserva.',
    );
    const cerrada = servicio({ actual: filaFicha({ estado: 'anulada' }) });
    await expect(cerrada.s.cobrarSena(CTX, 'r1', PAGO)).rejects.toThrow(
      /la seña se cobra con la reserva abierta/,
    );
    expect(otro.tx.alqCobro.create).not.toHaveBeenCalled();
  });

  it('regla 169: con el recibo hecho, el importe de la seña no se cambia', async () => {
    const { s, tx } = servicio({ actual: conSena() });
    await expect(s.actualizar(CTX, 'r1', entrada({ senaImporte: 700 }))).rejects.toThrow(
      'La seña ya tiene el recibo 000123: para cambiarla, anulá ese recibo en Cobros.',
    );
    await s.actualizar(CTX, 'r1', entrada({ vence: '2026-10-29' }));
    expect(tx.alqReserva.update).toHaveBeenCalledTimes(1);
  });

  it('regla 172: anular la reserva con la seña cobrada pide anular el recibo primero', async () => {
    const { s, tx } = servicio({ actual: conSena() });
    await expect(
      s.cambiarEstado(CTX, 'r1', { estado: 'anulada', motivo: 'Se cargó dos veces' }),
    ).rejects.toThrow(
      'La seña tiene el recibo 000123: anulalo primero, en Cobros, y después anulá la reserva.',
    );
    expect(tx.alqReserva.update).not.toHaveBeenCalled();
  });

  it.each([
    ['en_estudio', { estado: 'rechazada', motivo: 'Garantías insuficientes' }, '2026-10-16'],
    ['reservada', { estado: 'vencida' }, '2026-10-23'],
    ['aprobada', { estado: 'no_se_presento' }, '2026-10-20'],
  ] as const)(
    'regla 171: %s → %o retiene la seña y se la entrega al propietario',
    async (desde, cambio, hoy) => {
      const { s, tx } = servicio({
        actual: conSena({
          estado: desde,
          partes: [
            { personaId: ANA, papel: 'inquilino', persona: { nombre: 'Ana' } },
            { personaId: 'duena-1', papel: 'propietario', persona: { nombre: 'Marta' } },
            { personaId: 'duena-2', papel: 'propietario', persona: { nombre: 'Rosa' } },
          ],
        }),
      });
      await s.cambiarEstado(CTX, 'r1', cambio as never, hoy);
      const filas = tx.alqConcepto.createMany.mock.calls[0]![0].data;
      // En partes iguales, a pagar a cada propietario, ligadas a la seña y a su recibo.
      expect(filas).toEqual([
        expect.objectContaining({
          personaId: 'duena-1',
          tipo: 'sena',
          sentido: 'a_pagar',
          importe: 250,
          moneda: 'USD',
          reservaId: 'r1',
          origenId: 'k-sena',
          cobroId: 'c-sena',
        }),
        expect.objectContaining({ personaId: 'duena-2', importe: 250 }),
      ]);
      expect(tx.alqEvento.createMany.mock.calls.at(-1)![0].data[0].resumen).toContain(
        'la seña de U$S 500,00 se le entrega al propietario en su próxima liquidación',
      );
    },
  );

  it('regla 171: con honorarios configurados, se le descuentan al propietario (más IVA)', async () => {
    const { s, tx } = servicio({
      actual: conSena({
        estado: 'en_estudio',
        partes: [{ personaId: 'duena-1', papel: 'propietario', persona: { nombre: 'Marta' } }],
      }),
      config: { honorariosSenaRetenidaPct: 10, ivaHonorariosPct: 21 },
    });
    await s.cambiarEstado(
      CTX,
      'r1',
      { estado: 'rechazada', motivo: 'Sin garantías' },
      '2026-10-16',
    );
    expect(tx.alqConcepto.createMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({ tipo: 'sena', sentido: 'a_pagar', importe: 500 }),
      expect.objectContaining({
        tipo: 'honorarios',
        sentido: 'a_cobrar',
        personaId: 'duena-1',
        importe: 60.5,
      }),
    ]);
  });

  it('regla 171: sin propietario cargado, cerrar pide uno; elegido, se suma a la reserva', async () => {
    const sinDueno = servicio({ actual: conSena({ estado: 'aprobada' }) });
    await expect(
      sinDueno.s.cambiarEstado(CTX, 'r1', { estado: 'no_se_presento' }, '2026-10-20'),
    ).rejects.toThrow(
      'Para retener la seña hace falta el propietario: elegí a quién se le entrega.',
    );
    expect(sinDueno.tx.alqReserva.update).not.toHaveBeenCalled();
    const elegido = servicio({ actual: conSena({ estado: 'aprobada' }) });
    await elegido.s.cambiarEstado(
      CTX,
      'r1',
      { estado: 'no_se_presento', propietarioId: 'duena-1' },
      '2026-10-20',
    );
    expect(elegido.tx.alqReservaParte.create).toHaveBeenCalledWith({
      data: {
        tenantId: CTX.tenantId,
        reservaId: 'r1',
        personaId: 'duena-1',
        papel: 'propietario',
      },
    });
    expect(elegido.tx.alqConcepto.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      personaId: 'duena-1',
      importe: 500,
    });
  });

  it('regla 171: sin seña cobrada no hay nada que retener', async () => {
    const { s, tx } = servicio({ actual: filaFicha({ estado: 'aprobada' }) });
    await s.cambiarEstado(CTX, 'r1', { estado: 'no_se_presento' }, '2026-10-20');
    expect(tx.alqConcepto.createMany).not.toHaveBeenCalled();
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'no_se_presento' },
    });
  });

  const contratoCon = (depositoImporte: number | null, depositoMoneda: 'ARS' | 'USD' | null) =>
    ({
      propiedadId: PROPIEDAD,
      moneda: 'ARS',
      depositoImporte,
      depositoMoneda,
    }) as unknown as Contrato;

  it('regla 170: al convertir, la seña pasa a ser el depósito del contrato', async () => {
    const { s, tx } = servicio({ actual: conSena({ estado: 'aprobada' }) });
    await s.convertir(CTX, 'r1', contratoCon(500, 'USD'));
    expect(tx.alqConcepto.update).toHaveBeenCalledWith({
      where: { id: 'k-sena' },
      data: { contratoId: 'k1' },
    });
    expect(tx.alqConcepto.create).not.toHaveBeenCalled();
    expect(tx.alqEvento.createMany.mock.calls.at(-1)![0].data[0].resumen).toBe(
      'Reserva 1 convertida en el contrato ALT-0012. La seña de U$S 500,00 pasa a ser el depósito',
    );
  });

  it('regla 170: depósito menor que la seña: se le reintegra la diferencia al inquilino', async () => {
    const { s, tx } = servicio({ actual: conSena({ estado: 'aprobada' }) });
    await s.convertir(CTX, 'r1', contratoCon(400, 'USD'));
    expect(tx.alqConcepto.create.mock.calls[0]![0].data).toMatchObject({
      contratoId: 'k1',
      reservaId: 'r1',
      personaId: ANA,
      tipo: 'deposito',
      sentido: 'a_pagar',
      importe: 100,
      moneda: 'USD',
      claveGeneracion: `dep|k1|excedente|${ANA}`,
      cobroId: 'c-sena',
    });
    expect(tx.alqEvento.createMany.mock.calls.at(-1)![0].data[0].resumen).toContain(
      'se le reintegran U$S 100,00 al inquilino',
    );
  });

  it('regla 170: depósito mayor: la diferencia la propone «Cargos de ingreso»', async () => {
    const { s, tx } = servicio({ actual: conSena({ estado: 'aprobada' }) });
    await s.convertir(CTX, 'r1', contratoCon(600, 'USD'));
    expect(tx.alqConcepto.create).not.toHaveBeenCalled();
    expect(tx.alqEvento.createMany.mock.calls.at(-1)![0].data[0].resumen).toContain(
      'faltan U$S 100,00, que se proponen como cargo de ingreso',
    );
  });

  it('regla 170: la seña y el depósito tienen que ser de la misma moneda', async () => {
    const { s, tx } = servicio({ actual: conSena({ estado: 'aprobada' }) });
    await expect(s.convertir(CTX, 'r1', contratoCon(500_000, 'ARS'))).rejects.toThrow(
      /la seña pasa a ser el depósito, así que tienen que ser de la misma moneda/,
    );
    expect(tx.alqConcepto.update).not.toHaveBeenCalled();
  });

  it('la ficha dice el recibo de la seña y lo que se retuvo', async () => {
    const retenida = { ...SENA_COBRADA, id: 'k-ret', sentido: 'a_pagar', cobro: null };
    const { s } = servicio({
      actual: conSena({ estado: 'rechazada', conceptos: [SENA_COBRADA, retenida] }),
    });
    const r = await s.obtener('r1');
    expect(r.sena).toEqual({
      importe: 500,
      moneda: 'USD',
      recibida: true,
      recibidaEl: '2026-10-15',
      medio: 'transferencia',
      recibo: { id: 'c-sena', numero: 123 },
    });
    expect(r.senaRetenida).toBe(500);
  });
});

describe('ReservasService · lista y ficha (reglas 164 y 168)', () => {
  it('regla 164: abre en las abiertas; «todas» no filtra; un estado filtra por ese', async () => {
    const { s, tx } = servicio();
    await s.listar();
    await s.listar('todas');
    await s.listar('vencida');
    const wheres = tx.alqReserva.findMany.mock.calls.map((c) => (c[0] as { where: unknown }).where);
    expect(wheres).toEqual([
      { estado: { in: ['reservada', 'en_estudio', 'aprobada'] } },
      {},
      { estado: 'vencida' },
    ]);
  });

  it('la ficha trae las partes, la seña, las garantías y la línea de tiempo', async () => {
    const { s } = servicio({ actual: filaFicha({ garantias: [garantia('aprobada')] }) });
    const r = await s.obtener('r1');
    expect(r).toMatchObject({
      numero: 1,
      interesados: [{ id: ANA, nombre: 'Ana Interesada' }],
      partes: [
        { personaId: ANA, papel: 'inquilino' },
        { personaId: CARLOS, papel: 'garante' },
      ],
      // Acordada y todavía sin cobrar: sin recibo.
      sena: { importe: 500, moneda: 'USD', recibida: false, recibo: null },
      alquilerInicial: 600_000,
      depositoMoneda: 'USD',
      registrado: { por: 'Lucía Operadora' },
      garantias: [{ estado: 'aprobada', aprobadaEl: '2026-10-16' }],
      historial: [{ resumen: 'Reserva 1: Mitre 100 2° A, reservada' }],
    });
  });

  it('regla 168: la lista, la ficha y convertir hacen las mismas consultas con 5 o con 25', async () => {
    const cuantas = async (n: number) => {
      const muchas = Array.from({ length: n }, (_, i) => filaFicha({ id: `r${i}`, numero: i }));
      const garantias = Array.from({ length: n }, () => garantia('aprobada'));
      const partes = Array.from({ length: n }, (_, i) => ({
        personaId: ANA,
        papel: 'inquilino',
        persona: { nombre: `Persona ${i}` },
      }));
      const lista = servicio({ lista: muchas });
      await lista.s.listar('todas');
      const ficha = servicio({ actual: filaFicha({ partes, garantias }) });
      await ficha.s.obtener('r1');
      const conv = servicio({ actual: filaFicha({ estado: 'aprobada' }), garantias });
      await conv.s.convertir(CTX, 'r1', contrato());
      return [lista.consultas(), ficha.consultas(), conv.consultas()];
    };
    expect(await cuantas(25)).toEqual(await cuantas(5));
  });
});
