import { describe, expect, it, vi } from 'vitest';
import { ExportacionService } from './exportacion.service';

// Se reemplaza el ZIP por un JSON de las planillas para poder leer su
// contenido sin descomprimir: lo que se prueba acá es qué va adentro.
vi.mock('../../common/zip', () => ({
  crearZip: (archivos: { nombre: string; contenido: Buffer }[]) =>
    Buffer.from(
      JSON.stringify(archivos.map((a) => ({ n: a.nombre, c: a.contenido.toString('utf8') }))),
    ),
}));

const CTX = { tenantId: 't1', userId: 'u1', roles: ['admin_tenant' as const] };

function armar() {
  const usuario = {
    id: 'ana',
    nombre: 'Ana',
    email: 'ana@x.test',
    telefono: null,
    estado: 'activo',
    roles: [{ rol: 'vendedor' }],
    lider: null,
  };
  const objetivo = (anio: number, objComision: number) => ({
    usuarioId: 'ana',
    anio,
    objComision,
    objVolumen: 1,
    objPuntas: 3,
    usuario: { nombre: 'Ana' },
  });
  const tx = {
    tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva' }) },
    usuario: { findMany: vi.fn().mockResolvedValue([usuario]) },
    objetivo: {
      findMany: vi.fn().mockResolvedValue([objetivo(2026, 11_111), objetivo(2027, 22_222)]),
    },
    operacion: { findMany: vi.fn().mockResolvedValue([]) },
    tasacion: { findMany: vi.fn().mockResolvedValue([]) },
    protocolo: { findMany: vi.fn().mockResolvedValue([]) },
    protocoloAccion: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const db = { withTenant: async (fn: (t: unknown) => unknown) => fn(tx) };
  return new ExportacionService(db as never);
}

async function planilla(anio: number, nombre: string): Promise<string> {
  const { buffer } = await armar().exportar(CTX, anio);
  const archivos = JSON.parse(buffer.toString('utf8')) as { n: string; c: string }[];
  return archivos.find((a) => a.n === nombre)!.c;
}

describe('Exportación · objetivos', () => {
  // Decía «2026» escrito a mano: desde enero de 2027 la columna habría
  // salido vacía para todos.
  it('vendedores.csv lleva el objetivo del año pedido, no uno fijo', async () => {
    const csv = await planilla(2027, 'vendedores.csv');
    expect(csv).toContain('Objetivo de comisión 2027');
    expect(csv).toContain('22222');
    expect(csv).not.toContain('11111');
  });

  it('objetivos.csv trae todos los años', async () => {
    const csv = await planilla(2027, 'objetivos.csv');
    expect(csv).toContain('2026');
    expect(csv).toContain('2027');
    expect(csv).toContain('11111');
    expect(csv).toContain('22222');
  });
});
