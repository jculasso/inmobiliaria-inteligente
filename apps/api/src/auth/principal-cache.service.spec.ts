import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from './auth-principal';
import { PrincipalCacheService } from './principal-cache.service';

function principal(userId: string, tenantId = 't1'): AuthPrincipal {
  return { userId, tenantId } as AuthPrincipal;
}

describe('PrincipalCacheService', () => {
  it('comparte la carga en vuelo entre requests simultáneas', async () => {
    const cache = new PrincipalCacheService();
    const cargar = vi.fn(async () => principal('u1'));
    const [a, b] = await Promise.all([cache.obtener('tok', cargar), cache.obtener('tok', cargar)]);
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('una vez resuelto, la siguiente request no vuelve a cargar', async () => {
    const cache = new PrincipalCacheService();
    const cargar = vi.fn(async () => principal('u1'));
    await cache.obtener('tok', cargar);
    await cache.obtener('tok', cargar);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('invalidarUsuario obliga a releer (baja, cambio de roles)', async () => {
    const cache = new PrincipalCacheService();
    const cargar = vi.fn(async () => principal('u1'));
    await cache.obtener('tok', cargar);
    cache.invalidarUsuario('u1');
    await cache.obtener('tok', cargar);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('invalidarTenant descarta a todos los de esa inmobiliaria y a nadie más', async () => {
    const cache = new PrincipalCacheService();
    const a = vi.fn(async () => principal('u1', 't1'));
    const b = vi.fn(async () => principal('u2', 't2'));
    await cache.obtener('ta', a);
    await cache.obtener('tb', b);
    cache.invalidarTenant('t1');
    await cache.obtener('ta', a);
    await cache.obtener('tb', b);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('una carga que empezó antes de la invalidación no queda cacheada', async () => {
    const cache = new PrincipalCacheService();
    let soltar: (p: AuthPrincipal) => void = () => undefined;
    const lenta = vi.fn(
      () =>
        new Promise<AuthPrincipal>((r) => {
          soltar = r;
        }),
    );
    const enVuelo = cache.obtener('tok', lenta);
    cache.invalidarUsuario('u1');
    soltar(principal('u1'));
    await enVuelo;
    const fresca = vi.fn(async () => principal('u1'));
    await cache.obtener('tok', fresca);
    expect(fresca).toHaveBeenCalledTimes(1);
  });

  it('un error no queda cacheado', async () => {
    const cache = new PrincipalCacheService();
    const falla = vi.fn(async (): Promise<AuthPrincipal> => {
      throw new Error('token inválido');
    });
    await expect(cache.obtener('tok', falla)).rejects.toThrow();
    await expect(cache.obtener('tok', falla)).rejects.toThrow();
    expect(falla).toHaveBeenCalledTimes(2);
  });
});
