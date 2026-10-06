import { vi } from 'vitest';

/**
 * Lo que necesita `registrarEventos` en un `tx` de prueba: el nombre del
 * operador y el insert del historial. Para sumar a los `makeTx` de cada spec.
 */
export function mocksDeHistorial(nombre = 'Lucía Operadora') {
  return {
    usuario: {
      findUnique: vi.fn().mockResolvedValue({ nombre }),
      findMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => args.where.id.in.map((id) => ({ id, nombre }))),
    },
    alqEvento: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
}
