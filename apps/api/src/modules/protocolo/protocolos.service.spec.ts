import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PLANTILLA_ACCIONES } from '@vacker/types';
import type { SupabaseStorageService } from '../../common/supabase-storage.service';
import type { TenantContext } from '../../prisma/tenant-context';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { ProtocolosService } from './protocolos.service';

const CTX_DIRECCION: TenantContext = { tenantId: 't1', userId: 'ceo', roles: ['direccion'] };
const CTX_VENDEDOR: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['vendedor'] };

function makeTx(over: Record<string, unknown> = {}) {
  return {
    tasacion: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    protocolo: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    protocoloAccion: { findUnique: vi.fn(), update: vi.fn() },
    usuario: { findMany: vi.fn().mockResolvedValue([]) },
    ...over,
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

/** Storage stub: los casos testeados no llegan a firmar fotos. */
function makeStorage(): SupabaseStorageService {
  return {
    signedUrls: vi.fn().mockResolvedValue([]),
    signedUrl: vi.fn(),
    keyDe: vi.fn((_b: string, s: string) => s),
  } as unknown as SupabaseStorageService;
}

const TASACION_CAPTADA = {
  id: 'tas1',
  estado: 'Captada',
  agenteId: 'u1',
  cliente: 'Juan Pérez',
  protocolo: null,
};

describe('ProtocolosService — iniciar', () => {
  it('rechaza una tasación que no está Captada', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue({ ...TASACION_CAPTADA, estado: 'Presentada' });
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.iniciar({ tasacionId: 'tas1', moneda: 'USD' }, CTX_DIRECCION)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.protocolo.create).not.toHaveBeenCalled();
  });

  it('rechaza si la propiedad ya tiene un protocolo', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue({ ...TASACION_CAPTADA, protocolo: { id: 'p1' } });
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.iniciar({ tasacionId: 'tas1', moneda: 'USD' }, CTX_DIRECCION)).rejects.toThrow(
      ConflictException,
    );
  });

  it('un vendedor no puede iniciar el protocolo de otro agente (404, no filtra existencia)', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue({ ...TASACION_CAPTADA, agenteId: 'otro' });
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.iniciar({ tasacionId: 'tas1', moneda: 'USD' }, CTX_VENDEDOR)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.protocolo.create).not.toHaveBeenCalled();
  });

  it('copia las 29 acciones de la plantilla y el responsable es el agente de la tasación', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue(TASACION_CAPTADA);
    tx.protocolo.findUniqueOrThrow = vi.fn().mockResolvedValue(filaProtocolo());
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await svc.iniciar({ tasacionId: 'tas1', moneda: 'USD', fechaInicio: '2026-07-01' }, CTX_DIRECCION);

    const data = tx.protocolo.create.mock.calls[0]![0].data;
    expect(data.acciones.create).toHaveLength(PLANTILLA_ACCIONES.length);
    expect(PLANTILLA_ACCIONES).toHaveLength(29);
    // El CEO inicia, pero el responsable sigue siendo el agente que captó.
    expect(data.agenteId).toBe('u1');
    // El nombre del propietario se hereda del cliente de la tasación.
    expect(data.propietarioNombre).toBe('Juan Pérez');
  });

  it('fecha cada acción al último día de su semana', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue(TASACION_CAPTADA);
    tx.protocolo.findUniqueOrThrow = vi.fn().mockResolvedValue(filaProtocolo());
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await svc.iniciar({ tasacionId: 'tas1', moneda: 'USD', fechaInicio: '2026-07-01' }, CTX_DIRECCION);

    const acciones = tx.protocolo.create.mock.calls[0]![0].data.acciones.create;
    const semana1 = acciones.find((a: { semana: number }) => a.semana === 1);
    const semana5 = acciones.find((a: { semana: number }) => a.semana === 5);
    expect(semana1.fechaPrevista.toISOString().slice(0, 10)).toBe('2026-07-07');
    expect(semana5.fechaPrevista.toISOString().slice(0, 10)).toBe('2026-08-04');
  });
});

describe('ProtocolosService — acceso por rol', () => {
  it('getOne: un vendedor no ve el protocolo de otro agente', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue({ ...filaProtocolo(), agenteId: 'otro' });
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.getOne('p1', CTX_VENDEDOR)).rejects.toThrow(NotFoundException);
  });

  it('getOne: 404 si no existe', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue(null);
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.getOne('p1', CTX_DIRECCION)).rejects.toThrow(NotFoundException);
  });
});

describe('ProtocolosService — acciones', () => {
  it('al marcar realizada sin fecha, completa con hoy', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue({ agenteId: 'u1', estado: 'activa' });
    tx.protocoloAccion.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'a1', protocoloId: 'p1', fechaRealizada: null });
    tx.protocolo.update = vi.fn().mockResolvedValue(filaProtocolo());
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await svc.updateAccion('p1', 'a1', { estado: 'realizada' }, CTX_VENDEDOR);

    expect(tx.protocoloAccion.update.mock.calls[0]![0].data.fechaRealizada).toBeInstanceOf(Date);
  });

  it('no pisa la fecha si el usuario mandó una', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue({ agenteId: 'u1', estado: 'activa' });
    tx.protocoloAccion.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'a1', protocoloId: 'p1', fechaRealizada: null });
    tx.protocolo.update = vi.fn().mockResolvedValue(filaProtocolo());
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await svc.updateAccion('p1', 'a1', { estado: 'realizada', fechaRealizada: '2026-07-03' }, CTX_VENDEDOR);

    const fecha = tx.protocoloAccion.update.mock.calls[0]![0].data.fechaRealizada as Date;
    expect(fecha.toISOString().slice(0, 10)).toBe('2026-07-03');
  });

  it('rechaza una acción que es de otro protocolo', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue({ agenteId: 'u1', estado: 'activa' });
    tx.protocoloAccion.findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'a1', protocoloId: 'OTRO', fechaRealizada: null });
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.updateAccion('p1', 'a1', { estado: 'realizada' }, CTX_VENDEDOR)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ProtocolosService — archivar', () => {
  it('no deja archivar dos veces', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue({ agenteId: 'u1', estado: 'archivada' });
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await expect(svc.archivar('p1', { motivo: 'vendida' }, CTX_VENDEDOR)).rejects.toThrow(ConflictException);
  });

  it('guarda motivo y fecha de archivo', async () => {
    const tx = makeTx();
    tx.protocolo.findUnique = vi.fn().mockResolvedValue({ agenteId: 'u1', estado: 'activa' });
    tx.protocolo.update = vi.fn().mockResolvedValue(filaProtocolo({ estado: 'archivada' }));
    const svc = new ProtocolosService(makeDb(tx), makeStorage());

    await svc.archivar('p1', { motivo: 'vendida', fecha: '2026-08-10' }, CTX_VENDEDOR);

    const data = tx.protocolo.update.mock.calls[0]![0].data;
    expect(data.estado).toBe('archivada');
    expect(data.motivoArchivo).toBe('vendida');
    expect((data.archivadoEn as Date).toISOString().slice(0, 10)).toBe('2026-08-10');
  });
});

/** Fila con el shape de `protocoloInclude`, lo mínimo para que `toDto` no falle. */
function filaProtocolo(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    estado: 'activa',
    fechaInicio: new Date('2026-07-01T00:00:00Z'),
    precioPublicado: null,
    moneda: 'USD',
    propietarioNombre: 'Juan Pérez',
    propietarioTelefono: null,
    propietarioEmail: null,
    vencimientoAutorizacion: null,
    consultas: 0,
    consultasCalificadas: 0,
    visitas: 0,
    interesadosActivos: 0,
    ofertas: 0,
    devolucionesMercado: null,
    objeciones: null,
    recomendacion: null,
    decisionPropietario: null,
    proximasAcciones: null,
    archivadoEn: null,
    motivoArchivo: null,
    observacionArchivo: null,
    agenteId: 'u1',
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    agente: { id: 'u1', nombre: 'Vendedor', email: 'v@t.test', telefono: null, fotoUrl: null },
    acciones: [],
    tasacion: {
      id: 'tas1',
      direccion: 'Calle Falsa 123',
      barrio: null,
      ciudad: null,
      tipoPropiedad: 'Casa',
      tipoOperacion: 'venta',
      superficieTotal: null,
      dormitorios: null,
      banos: null,
      valorRecomendado: null,
      fotos: [],
    },
    ...over,
  };
}
