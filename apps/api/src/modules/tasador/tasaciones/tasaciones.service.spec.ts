import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CambiarEstado } from '@vacker/types';
import type { DomainEventsService } from '../../../common/domain-events.service';
import type { SupabaseStorageService } from '../../../common/supabase-storage.service';
import type { TenantContext } from '../../../prisma/tenant-context';
import type { TenantPrismaService } from '../../../prisma/tenant-prisma.service';
import { TasacionesService, toDto, type TasacionRow } from './tasaciones.service';

const CTX_DIRECCION: TenantContext = { tenantId: 't1', userId: 'admin', roles: ['direccion'] };
const CTX_VENDEDOR: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['vendedor'] };

function makeTx(over: Record<string, unknown> = {}) {
  return {
    tasacion: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    tasacionEstadoHistorial: { create: vi.fn() },
    tasacionComparable: { deleteMany: vi.fn() },
    ...over,
  };
}

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

function makeEvents() {
  return { emit: vi.fn() } as unknown as DomainEventsService & { emit: ReturnType<typeof vi.fn> };
}

/** Storage stub: los casos testeados (getOne 404, cambiarEstado) no firman fotos. */
function makeStorage() {
  return {
    signedUrls: vi.fn().mockResolvedValue([]),
    signedUrl: vi.fn(),
    keyDe: vi.fn((_b: string, s: string) => s),
  } as unknown as SupabaseStorageService;
}

describe('TasacionesService — scope', () => {
  it('getOne: un vendedor NO ve una tasación de otro agente (assertEnScope → 404)', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue({ id: 'ta1', agenteId: 'otro' });
    const svc = new TasacionesService(makeDb(tx), makeEvents(), makeStorage());

    await expect(svc.getOne('ta1', CTX_VENDEDOR)).rejects.toThrow(NotFoundException);
  });

  it('getOne: 404 si la tasación no existe', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue(null);
    const svc = new TasacionesService(makeDb(tx), makeEvents(), makeStorage());

    await expect(svc.getOne('ta1', CTX_DIRECCION)).rejects.toThrow(NotFoundException);
  });
});

describe('toDto — enums legacy guardados como cadena vacía', () => {
  it("normaliza '' → null en los enums opcionales (si no, el schema de lectura rechaza la fila y no abre la edición)", () => {
    const row = {
      id: 'ta1',
      codigo: null,
      agenteId: 'u1',
      agente: { id: 'u1', nombre: 'Ana', email: 'a@a.com', fotoUrl: null },
      cliente: 'C',
      fecha: new Date('2026-01-01'),
      direccion: 'D',
      barrio: null,
      ciudad: null,
      tipoOperacion: 'venta',
      tipoPropiedad: 'Departamento',
      supCubierta: null,
      supSemicubierta: null,
      supDescubierta: null,
      supTerreno: null,
      superficieTotal: null,
      dormitorios: null,
      banos: null,
      toilette: null,
      ambientes: null,
      antiguedad: null,
      estadoInmueble: '',
      disposicion: '',
      orientacion: '',
      cochera: false,
      balcon: false,
      terraza: false,
      patio: false,
      lavadero: false,
      piscina: false,
      amenities: [],
      detalleAmenities: null,
      expensas: null,
      aptoCredito: '',
      documentacion: '',
      comparables: [
        { id: 'c1', direccion: 'X', superficie: null, precio: null, dormitorios: null, banos: null, cochera: false, estado: '', link: null, observaciones: null },
      ],
      fotos: [],
      analisisComercial: null,
      valorMinimo: null,
      valorRecomendado: null,
      valorAspiracional: null,
      margenNegociacion: null,
      escenarioRecomendado: '',
      plazoEstimado: '',
      estrategiaComercial: null,
      estado: 'En proceso',
      exclusividad: null,
      motivoNoCaptada: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    const dto = toDto(row as unknown as TasacionRow);

    expect(dto.estadoInmueble).toBeNull();
    expect(dto.disposicion).toBeNull();
    expect(dto.orientacion).toBeNull();
    expect(dto.aptoCredito).toBeNull();
    expect(dto.documentacion).toBeNull();
    expect(dto.escenarioRecomendado).toBeNull();
    expect(dto.plazoEstimado).toBeNull();
    expect(dto.comparables[0]!.estado).toBeNull();
  });
});

describe('TasacionesService — cambiarEstado', () => {
  it('registra el historial y emite los eventos de dominio (Captada → también tasacion_captada)', async () => {
    const tx = makeTx();
    tx.tasacion.findUnique = vi.fn().mockResolvedValue({
      id: 'ta1',
      tenantId: 't1',
      agenteId: 'u2',
      estado: 'En proceso',
      supCubierta: null,
      supSemicubierta: null,
      supDescubierta: null,
    });
    const events = makeEvents();
    const svc = new TasacionesService(makeDb(tx), events, makeStorage());

    const dto = { estado: 'Captada', exclusividad: { tipo: 'con_exclusividad' } } as unknown as CambiarEstado;
    const res = await svc.cambiarEstado('ta1', dto, CTX_DIRECCION);

    expect(res).toEqual({ id: 'ta1' });
    expect(tx.tasacion.update).toHaveBeenCalledTimes(1);
    // Deja rastro del cambio de estado (estado anterior → nuevo).
    expect(tx.tasacionEstadoHistorial.create).toHaveBeenCalledTimes(1);
    const histArg = tx.tasacionEstadoHistorial.create.mock.calls[0]![0] as {
      data: { estadoAnterior: string; estadoNuevo: string };
    };
    expect(histArg.data.estadoAnterior).toBe('En proceso');
    expect(histArg.data.estadoNuevo).toBe('Captada');
    // Emite el evento genérico + el específico de captación.
    const eventos = events.emit.mock.calls.map((c) => c[0]);
    expect(eventos).toContain('tasacion_estado_cambiado');
    expect(eventos).toContain('tasacion_captada');
  });
});
