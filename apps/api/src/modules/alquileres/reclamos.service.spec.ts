import { describe, expect, it, vi } from 'vitest';
import { ROLES_ADMINISTRACION_ALQUILERES } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { mocksDeHistorial } from './historial.testing';
import { ReclamosService } from './reclamos.service';

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const R = '33333333-3333-4333-8333-333333333333';
const LUCIA = '44444444-4444-4444-8444-444444444444';
const VENDEDOR = '77777777-7777-4777-8777-777777777777';
const PLOMERO = '88888888-8888-4888-8888-888888888888';
/** Quien lo sigue, como lo devuelve `usuario.findFirst`: por defecto, administración. */
const usuario = (nombre: string, roles: string[], estado = 'activo') => ({
  nombre,
  estado,
  roles: roles.map((rol) => ({ rol })),
});
const nuevo = (over: Record<string, unknown> = {}) => ({
  asunto: 'Pérdida de agua en el baño',
  descripcion: null,
  tipo: 'mantenimiento' as const,
  prioridad: 'alta' as const,
  contratoId: 'c5' as string | null,
  personaId: null,
  asignadoAId: null as string | null,
  proveedorId: null as string | null,
  ...over,
});
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
  proveedorId: null,
  creadoPorId: 'u1',
  cerradoEn: null,
  createdAt: new Date('2026-10-06T12:00:00Z'),
  updatedAt: new Date('2026-10-06T12:00:00Z'),
  notas: [],
  ...over,
});

function armar(r = fila()) {
  const historial = mocksDeHistorial();
  const tx = {
    ...historial,
    usuario: {
      ...historial.usuario,
      findFirst: vi.fn().mockResolvedValue(usuario('Lucía Operadora', ['administracion'])),
    },
    alqProveedor: {
      findFirst: vi.fn().mockResolvedValue({ nombre: 'Juan Plomero' }),
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: PLOMERO, nombre: 'Juan Plomero', telefono: '341 555-1234', email: null },
        ]),
    },
    $executeRaw: vi.fn(),
    alqReclamo: {
      findUnique: vi.fn().mockResolvedValue(r),
      findMany: vi.fn().mockResolvedValue([r]),
      aggregate: vi.fn().mockResolvedValue({ _max: { numero: 6 } }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...r,
        ...data,
        id: R,
      })),
      update: vi.fn(),
    },
    alqReclamoNota: { create: vi.fn() },
    alqContrato: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'c5',
          codigo: 'ALT-0005',
          propiedad: { direccion: 'Mendoza 3340', unidad: '2° C' },
        },
      ]),
    },
    alqPersona: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([{ id: 'p1', nombre: 'Ana Inquilina' }]),
    },
    alqContratoParte: { findFirst: vi.fn().mockResolvedValue({ personaId: 'p1' }) },
  };
  const db = {
    withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  } as unknown as TenantPrismaService;
  return { tx, servicio: new ReclamosService(db) };
}

describe('ReclamosService (entrega 15)', () => {
  it('abre con el número siguiente, la persona del contrato, una nota y el historial', async () => {
    const { tx, servicio } = armar();
    const r = await servicio.crear(CTX, nuevo());
    expect(tx.alqReclamo.create.mock.calls[0]![0].data).toMatchObject({
      numero: 7,
      personaId: 'p1',
      creadoPorId: 'u1',
      tenantId: 't1',
    });
    expect(tx.alqReclamoNota.create.mock.calls[0]![0].data).toMatchObject({
      texto: 'Abrió el reclamo (alta prioridad).',
      usuarioNombre: 'Lucía Operadora',
    });
    expect(r.contrato).toEqual({ id: 'c5', codigo: 'ALT-0005', propiedad: 'Mendoza 3340 2° C' });
  });

  it('cada cambio deja su nota: estado, asignado y lo que se hizo', async () => {
    const { tx, servicio } = armar();
    await servicio.cambiar(CTX, R, {
      estado: 'en_curso',
      asignadoAId: LUCIA,
      nota: 'Va el plomero el jueves.',
    });
    expect(tx.alqReclamo.update.mock.calls[0]![0].data).toMatchObject({
      estado: 'en_curso',
      asignadoAId: LUCIA,
    });
    expect(tx.alqReclamoNota.create.mock.calls[0]![0].data.texto).toBe(
      'Estado: Abierto → En curso. Lo sigue: Lucía Operadora. Va el plomero el jueves.',
    );
  });

  it('los abiertos primero por prioridad', async () => {
    const { tx, servicio } = armar();
    tx.alqReclamo.findMany.mockResolvedValueOnce([
      fila({ id: 'a', prioridad: 'baja' }),
      fila({ id: 'b', prioridad: 'urgente' }),
    ]);
    expect((await servicio.listar({ estado: 'abiertos' })).map((r) => r.prioridad)).toEqual([
      'urgente',
      'baja',
    ]);
    expect(tx.alqReclamo.findMany.mock.calls[0]![0].where).toEqual({
      estado: { in: ['abierto', 'en_curso'] },
    });
  });

  // Auditoría del 6/10/2026: el reclamo no tiene claves foráneas; un id de otra inmobiliaria se guardaba igual.
  it('un contrato o un usuario que no es de la inmobiliaria se rechaza', async () => {
    const { tx, servicio } = armar();
    tx.alqContrato.count.mockResolvedValueOnce(0);
    await expect(servicio.crear(CTX, nuevo({ contratoId: 'otro' }))).rejects.toThrow(
      'El contrato no existe.',
    );
    tx.usuario.findFirst.mockResolvedValueOnce(null);
    await expect(servicio.cambiar(CTX, 'r1', { asignadoAId: 'ajeno', nota: null })).rejects.toThrow(
      'El usuario asignado no existe.',
    );
  });
});

// Javier, 7/10/2026: «los reclamos se los asignás a los vendedores, eso está mal».
describe('ReclamosService · quién lo sigue y el proveedor (reglas 60 a 66)', () => {
  it('regla 60: se abre con quién lo sigue y el proveedor, los dos opcionales', async () => {
    const { tx, servicio } = armar();
    await servicio.crear(CTX, nuevo({ asignadoAId: LUCIA, proveedorId: PLOMERO }));
    expect(tx.alqReclamo.create.mock.calls[0]![0].data).toMatchObject({
      asignadoAId: LUCIA,
      proveedorId: PLOMERO,
    });
    const { tx: tx2, servicio: s2 } = armar();
    await s2.crear(CTX, nuevo());
    expect(tx2.alqReclamo.create.mock.calls[0]![0].data).toMatchObject({
      asignadoAId: null,
      proveedorId: null,
    });
    expect(tx2.usuario.findFirst).not.toHaveBeenCalled();
    expect(tx2.alqProveedor.findFirst).not.toHaveBeenCalled();
  });

  it('regla 61: la lista de «Lo sigue» trae solo activos con un rol que entra al módulo', async () => {
    const { tx, servicio } = armar();
    tx.usuario.findMany.mockResolvedValueOnce([{ id: LUCIA, nombre: 'Lucía Operadora' }]);
    await servicio.usuarios();
    expect(tx.usuario.findMany.mock.calls[0]![0].where).toEqual({
      estado: 'activo',
      roles: { some: { rol: { in: [...ROLES_ADMINISTRACION_ALQUILERES] } } },
    });
  });

  it('regla 62: abrir un reclamo para que lo siga un vendedor se rechaza con su nombre', async () => {
    const { tx, servicio } = armar();
    tx.usuario.findFirst.mockResolvedValue(usuario('Pedro Vendedor', ['vendedor']));
    await expect(servicio.crear(CTX, nuevo({ asignadoAId: VENDEDOR }))).rejects.toMatchObject({
      status: 400,
      message: 'Pedro Vendedor no usa Alquileres: el reclamo lo sigue alguien que entra al módulo.',
    });
    expect(tx.alqReclamo.create).not.toHaveBeenCalled();
  });

  it('regla 62: reasignarlo a un team leader o a alguien inactivo se rechaza, sin guardar nada', async () => {
    const { tx, servicio } = armar();
    tx.usuario.findFirst.mockResolvedValueOnce(
      usuario('Tamara Líder', ['team_leader', 'vendedor']),
    );
    await expect(
      servicio.cambiar(CTX, R, { asignadoAId: VENDEDOR, nota: null }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Tamara Líder no usa Alquileres'),
    });
    tx.usuario.findFirst.mockResolvedValueOnce(
      usuario('Ana Admin', ['administracion'], 'inactivo'),
    );
    await expect(
      servicio.cambiar(CTX, R, { asignadoAId: VENDEDOR, nota: null }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Ana Admin está inactivo'),
    });
    expect(tx.alqReclamo.update).not.toHaveBeenCalled();
    expect(tx.alqReclamoNota.create).not.toHaveBeenCalled();
  });

  it('regla 62: dirección y admin sí pueden seguirlo, aunque además sean vendedores', async () => {
    for (const rol of ['direccion', 'admin_tenant']) {
      const { tx, servicio } = armar();
      tx.usuario.findFirst.mockResolvedValueOnce(usuario('Marta', ['vendedor', rol]));
      await servicio.cambiar(CTX, R, { asignadoAId: LUCIA, nota: null });
      expect(tx.alqReclamo.update.mock.calls[0]![0].data).toEqual({ asignadoAId: LUCIA });
      expect(tx.alqReclamoNota.create.mock.calls[0]![0].data.texto).toBe('Lo sigue: Marta.');
    }
  });

  it('regla 63: un reclamo viejo de un vendedor se guarda si no se lo toca, y se puede reasignar', async () => {
    const { tx, servicio } = armar(fila({ asignadoAId: VENDEDOR }));
    tx.usuario.findFirst.mockResolvedValue(usuario('Pedro Vendedor', ['vendedor']));
    // Otro cambio, mandando el mismo valor: no falla y no lo toca.
    await servicio.cambiar(CTX, R, { estado: 'en_curso', asignadoAId: VENDEDOR, nota: null });
    expect(tx.alqReclamo.update.mock.calls[0]![0].data).toEqual({
      estado: 'en_curso',
      cerradoEn: null,
    });
    // «Sin asignar» funciona.
    await servicio.cambiar(CTX, R, { asignadoAId: null, nota: null });
    expect(tx.alqReclamo.update.mock.calls[1]![0].data).toEqual({ asignadoAId: null });
    expect(tx.alqReclamoNota.create.mock.calls[1]![0].data.texto).toBe('Sin asignar.');
    // Y en la lista sigue apareciendo con su nombre.
    tx.usuario.findMany.mockResolvedValueOnce([{ id: VENDEDOR, nombre: 'Pedro Vendedor' }]);
    const [resumen] = await servicio.listar({ estado: 'todos' });
    expect(resumen!.asignadoA).toBe('Pedro Vendedor');
  });

  it('regla 64: un proveedor que no es de la inmobiliaria se rechaza', async () => {
    const { tx, servicio } = armar();
    tx.alqProveedor.findFirst.mockResolvedValue(null);
    await expect(servicio.crear(CTX, nuevo({ proveedorId: PLOMERO }))).rejects.toThrow(
      'El proveedor no existe.',
    );
    await expect(servicio.cambiar(CTX, R, { proveedorId: PLOMERO, nota: null })).rejects.toThrow(
      'El proveedor no existe.',
    );
    expect(tx.alqReclamo.create).not.toHaveBeenCalled();
    expect(tx.alqReclamo.update).not.toHaveBeenCalled();
  });

  it('regla 65: cambiar el proveedor deja su nota en el historial', async () => {
    const { tx, servicio } = armar();
    await servicio.cambiar(CTX, R, { proveedorId: PLOMERO, nota: 'Pasa el jueves.' });
    expect(tx.alqReclamo.update.mock.calls[0]![0].data).toEqual({ proveedorId: PLOMERO });
    expect(tx.alqReclamoNota.create.mock.calls[0]![0].data.texto).toBe(
      'Proveedor: Juan Plomero. Pasa el jueves.',
    );
    const { tx: tx2, servicio: s2 } = armar(fila({ proveedorId: PLOMERO }));
    await s2.cambiar(CTX, R, { proveedorId: null, nota: null });
    expect(tx2.alqReclamoNota.create.mock.calls[0]![0].data.texto).toBe('Sin proveedor.');
  });

  it('regla 66: la lista y la ficha traen el proveedor con teléfono y email, en una sola consulta', async () => {
    const { tx, servicio } = armar();
    tx.alqReclamo.findMany.mockResolvedValueOnce([
      fila({ id: 'a', proveedorId: PLOMERO }),
      fila({ id: 'b', proveedorId: PLOMERO }),
      fila({ id: 'c' }),
    ]);
    const lista = await servicio.listar({ estado: 'todos' });
    expect(Object.fromEntries(lista.map((r) => [r.id, r.proveedor?.nombre ?? null]))).toEqual({
      a: 'Juan Plomero',
      b: 'Juan Plomero',
      c: null,
    });
    expect(tx.alqProveedor.findMany).toHaveBeenCalledTimes(1);
    const { servicio: s2 } = armar(fila({ proveedorId: PLOMERO }));
    expect((await s2.obtener(R)).proveedor).toEqual({
      id: PLOMERO,
      nombre: 'Juan Plomero',
      telefono: '341 555-1234',
      email: null,
    });
  });
});
