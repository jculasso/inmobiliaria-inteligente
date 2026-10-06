import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PersonaInputSchema } from '@vacker/types';
import type { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { PersonasService } from './personas.service';
import { mocksDeHistorial } from './historial.testing';

function makeDb(tx: unknown): TenantPrismaService {
  return { withTenant: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } as unknown as TenantPrismaService;
}

const CTX = { tenantId: 't1', userId: 'u1', roles: ['administracion' as const] };
const ANA = PersonaInputSchema.parse({ nombre: 'Ana Pérez', documento: '20.123.456' });

function makeTx(over: { findFirst?: unknown; findUnique?: unknown } = {}) {
  return {
    ...mocksDeHistorial(),
    alqPersona: {
      findFirst: vi.fn().mockResolvedValue(over.findFirst ?? null),
      findUnique: vi.fn().mockResolvedValue(over.findUnique ?? { id: 'p1' }),
      create: vi.fn(async ({ data }) => ({ id: 'nueva', ...data })),
      update: vi.fn(async ({ data }) => ({ id: 'p1', ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    },
  };
}

describe('PersonasService', () => {
  it('da de alta con el documento ya normalizado', async () => {
    const tx = makeTx();
    const p = await new PersonasService(makeDb(tx)).crear(CTX, ANA);
    expect(p.documento).toBe('20123456');
    // El tenant sale del usuario autenticado: RLS lo exige al insertar.
    expect(tx.alqPersona.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1' }) }));
    expect(tx.alqPersona.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { documento: '20123456' } }));
  });

  /*
   * La misma persona dos veces tendría dos cuentas corrientes. La base lo
   * impide igual, pero el mensaje tiene que decir con quién choca.
   */
  it('un documento repetido se rechaza nombrando a quien ya lo tiene', async () => {
    const tx = makeTx({ findFirst: { nombre: 'Ana P.' } });
    await expect(new PersonasService(makeDb(tx)).crear(CTX, ANA)).rejects.toThrow(ConflictException);
    await expect(new PersonasService(makeDb(tx)).crear(CTX, ANA)).rejects.toThrow(/Ana P\./);
    expect(tx.alqPersona.create).not.toHaveBeenCalled();
  });

  it('sin documento no busca duplicados', async () => {
    const tx = makeTx();
    await new PersonasService(makeDb(tx)).crear(CTX, PersonaInputSchema.parse({ nombre: 'Sin DNI' }));
    expect(tx.alqPersona.findFirst).not.toHaveBeenCalled();
  });

  it('al editar, su propio documento no cuenta como duplicado', async () => {
    const tx = makeTx();
    await new PersonasService(makeDb(tx)).actualizar(CTX, 'p1', ANA);
    expect(tx.alqPersona.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documento: '20123456', NOT: { id: 'p1' } } }),
    );
  });

  it('editar una persona que no existe (o de otra inmobiliaria) es 404', async () => {
    const tx = makeTx({ findUnique: null });
    tx.alqPersona.findUnique.mockResolvedValue(null);
    await expect(new PersonasService(makeDb(tx)).actualizar(CTX, 'otra', ANA)).rejects.toThrow(NotFoundException);
    expect(tx.alqPersona.update).not.toHaveBeenCalled();
  });

  it('todo pasa por withTenant', async () => {
    const db = makeDb(makeTx());
    await new PersonasService(db).listar();
    expect(db.withTenant).toHaveBeenCalledTimes(1);
  });

  // Decidido con Javier el 6/10/2026: se borra solo lo que no tiene historia.
  it('borra a quien no tiene historia, y lo deja en el historial', async () => {
    const tx = makeTx({ findUnique: { nombre: 'Ana Pérez', _count: { partes: 0, conceptos: 0, cobros: 0, liquidaciones: 0, firmas: 0 } } });
    await new PersonasService(makeDb(tx)).borrar(CTX, 'p1');
    expect(tx.alqPersona.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({ accion: 'borrado', usuarioNombre: 'Lucía Operadora', resumen: 'Ana Pérez borrada' });
  });

  it('a quien tiene contratos o cobros no la borra, y dice qué tiene', async () => {
    const tx = makeTx({ findUnique: { nombre: 'Ana Pérez', _count: { partes: 2, conceptos: 0, cobros: 1, liquidaciones: 0, firmas: 0 } } });
    await expect(new PersonasService(makeDb(tx)).borrar(CTX, 'p1')).rejects.toThrow('Ana Pérez no se puede borrar: tiene 2 contratos, 1 cobro.');
    expect(tx.alqPersona.delete).not.toHaveBeenCalled();
  });

  it('el alta queda en el historial con el operador', async () => {
    const tx = makeTx();
    await new PersonasService(makeDb(tx)).crear(CTX, ANA);
    expect(tx.alqEvento.createMany.mock.calls[0]![0].data[0]).toMatchObject({ entidad: 'persona', accion: 'alta', usuarioId: 'u1', usuarioNombre: 'Lucía Operadora' });
  });
});
