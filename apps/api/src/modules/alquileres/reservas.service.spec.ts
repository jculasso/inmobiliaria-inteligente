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
    senaRecibida: true,
    senaRecibidaEl: '2026-10-15',
    senaMedio: 'transferencia',
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
    senaRecibida: true,
    senaRecibidaEl: d('2026-10-15'),
    senaMedio: 'transferencia',
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
    alqReservaParte: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
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
      senaRecibida: true,
      senaMedio: 'transferencia',
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

  it('regla 161: la reserva del contrato trae su seña', async () => {
    const { s, tx } = servicio();
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

  it('regla 160: borrar el contrato en borrador devuelve la reserva a aprobada', async () => {
    const { tx } = servicio({ actual: { id: 'r1', numero: 4 } });
    await devolverReservaDelContrato(tx as never, CTX, 'k1', 'ALT-0012');
    expect(tx.alqReserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { estado: 'aprobada', contratoId: null },
    });
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({
      entidad: 'reserva',
      entidadId: 'r1',
      resumen:
        'Reserva 4: se borró el contrato ALT-0012, que estaba en borrador; vuelve a aprobada',
    });
  });

  it('regla 160: un contrato que no salió de una reserva se borra sin tocar reservas', async () => {
    const { tx } = servicio({ actual: null });
    await devolverReservaDelContrato(tx as never, CTX, 'k1', 'ALT-0012');
    expect(tx.alqReserva.update).not.toHaveBeenCalled();
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
      sena: { importe: 500, moneda: 'USD', recibida: true },
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
