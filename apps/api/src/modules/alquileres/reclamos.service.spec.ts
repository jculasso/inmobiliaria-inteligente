import { describe, expect, it, vi } from 'vitest';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { ReclamosService } from './reclamos.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const R = '33333333-3333-4333-8333-333333333333';
const fila = (over: Record<string, unknown> = {}) => ({
  id: R,
  numero: 7,
  asunto: 'Pérdida de agua en el baño',
  descripcion: null,
  tipo: 'mantenimiento',
  prioridad: 'media',
  estado: 'abierto',
  contratoId: 'c5',
  personaId: 'p1',
  asignadoAId: null,
  creadoPorId: 'u1',
  cerradoEn: null,
  createdAt: new Date('2026-10-06T12:00:00Z'),
  updatedAt: new Date('2026-10-06T12:00:00Z'),
  notas: [],
  ...over,
});

function armar(r = fila()) {
  const tx = {
    ...mocksDeHistorial(),
    $executeRaw: vi.fn(),
    alqReclamo: {
      findUnique: vi.fn().mockResolvedValue(r),
      findMany: vi.fn().mockResolvedValue([r]),
      aggregate: vi.fn().mockResolvedValue({ _max: { numero: 6 } }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...r, ...data, id: R })),
      update: vi.fn(),
    },
    alqReclamoNota: { create: vi.fn() },
    alqContrato: { findMany: vi.fn().mockResolvedValue([{ id: 'c5', codigo: 'ALT-0005', propiedad: { direccion: 'Mendoza 3340', unidad: '2° C' } }]) },
    alqPersona: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', nombre: 'Ana Inquilina' }]) },
    alqContratoParte: { findFirst: vi.fn().mockResolvedValue({ personaId: 'p1' }) },
  };
  const db = { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
  return { tx, servicio: new ReclamosService(db) };
}

describe('ReclamosService (entrega 15)', () => {
  it('abre con el número siguiente, la persona del contrato, una nota y el historial', async () => {
    const { tx, servicio } = armar();
    const r = await servicio.crear(CTX, { asunto: 'Pérdida de agua en el baño', descripcion: null, tipo: 'mantenimiento', prioridad: 'alta', contratoId: 'c5', personaId: null, asignadoAId: null });
    expect(tx.alqReclamo.create.mock.calls[0]![0].data).toMatchObject({ numero: 7, personaId: 'p1', creadoPorId: 'u1', tenantId: 't1' });
    expect(tx.alqReclamoNota.create.mock.calls[0]![0].data).toMatchObject({ texto: 'Abrió el reclamo (alta prioridad).', usuarioNombre: 'Lucía Operadora' });
    expect(r.contrato).toEqual({ id: 'c5', codigo: 'ALT-0005', propiedad: 'Mendoza 3340 2° C' });
  });

  it('cada cambio deja su nota: estado, asignado y lo que se hizo', async () => {
    const { tx, servicio } = armar();
    await servicio.cambiar(CTX, R, { estado: 'en_curso', asignadoAId: '44444444-4444-4444-8444-444444444444', nota: 'Va el plomero el jueves.' });
    expect(tx.alqReclamo.update.mock.calls[0]![0].data).toMatchObject({ estado: 'en_curso', asignadoAId: '44444444-4444-4444-8444-444444444444' });
    expect(tx.alqReclamoNota.create.mock.calls[0]![0].data.texto).toBe('Estado: Abierto → En curso. Asignado a Lucía Operadora. Va el plomero el jueves.');
  });

  it('los abiertos primero por prioridad', async () => {
    const { tx, servicio } = armar();
    tx.alqReclamo.findMany.mockResolvedValueOnce([fila({ id: 'a', prioridad: 'baja' }), fila({ id: 'b', prioridad: 'urgente' })]);
    expect((await servicio.listar({ estado: 'abiertos' })).map((r) => r.prioridad)).toEqual(['urgente', 'baja']);
    expect(tx.alqReclamo.findMany.mock.calls[0]![0].where).toEqual({ estado: { in: ['abierto', 'en_curso'] } });
  });
});
