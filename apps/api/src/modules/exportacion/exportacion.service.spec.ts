import { describe, expect, it, vi } from 'vitest';
import { ExportacionService } from './exportacion.service';

const CTX = { tenantId: 'inquilino-a', userId: 'u1', roles: ['admin_tenant' as const] };

function makeTx() {
  const vacio = { findMany: vi.fn().mockResolvedValue([]) };
  return {
    tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ nombre: 'Alteva Propiedades' }) },
    usuario: { findMany: vi.fn().mockResolvedValue([]) },
    objetivo: { ...vacio, findMany: vi.fn().mockResolvedValue([]) },
    operacion: { findMany: vi.fn().mockResolvedValue([]) },
    tasacion: { findMany: vi.fn().mockResolvedValue([]) },
    protocolo: { findMany: vi.fn().mockResolvedValue([]) },
    protocoloAccion: { findMany: vi.fn().mockResolvedValue([]) },
  };
}
const makeDb = (tx: unknown) => ({ withTenant: async (fn: (t: unknown) => unknown) => fn(tx) });

describe('ExportacionService', () => {
  /**
   * La barrera real es RLS, pero este es el ÚNICO endpoint que vuelca la
   * cartera entera: si algún día faltara una policy en una tabla nueva, acá la
   * fuga sería total. Por eso el filtro por inquilino también va explícito, y
   * por eso hay un test que lo verifica en TODAS las consultas.
   */
  it('todas las consultas filtran por inquilino, además de RLS', async () => {
    const tx = makeTx();
    await new ExportacionService(makeDb(tx) as never).exportar(CTX);

    for (const tabla of ['usuario', 'objetivo', 'operacion', 'tasacion', 'protocolo', 'protocoloAccion'] as const) {
      const args = tx[tabla].findMany.mock.calls[0]?.[0];
      expect(args?.where, `${tabla} no filtra por inquilino`).toMatchObject({ tenantId: 'inquilino-a' });
    }
  });

  it('devuelve un ZIP con las siete planillas y el LEEME', async () => {
    const { buffer, nombreArchivo } = await new ExportacionService(makeDb(makeTx()) as never).exportar(CTX);

    expect(buffer.subarray(0, 2).toString()).toBe('PK'); // firma de ZIP
    const crudo = buffer.toString('latin1');
    for (const n of ['LEEME.txt', 'operaciones.csv', 'operaciones-puntas.csv', 'tasaciones.csv',
                     'tasaciones-comparables.csv', 'protocolos.csv', 'protocolos-acciones.csv',
                     'vendedores.csv']) {
      expect(crudo, `falta ${n}`).toContain(n);
    }
    expect(nombreArchivo).toMatch(/^alteva-propiedades-datos-\d{4}-\d{2}-\d{2}$/);
  });

  // Una inmobiliaria recién dada de alta también tiene derecho a llevarse lo
  // suyo, aunque sea nada: que el archivo salga vacío es correcto, que
  // reviente no.
  it('no se rompe con una inmobiliaria sin datos', async () => {
    const { buffer } = await new ExportacionService(makeDb(makeTx()) as never).exportar(CTX);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
