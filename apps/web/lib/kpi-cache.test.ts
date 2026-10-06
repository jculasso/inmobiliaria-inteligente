import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alcanceDe, getOrFetch } from './kpi-cache';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('getOrFetch', () => {
  it('dos componentes que montan a la vez comparten una sola consulta', async () => {
    const fetcher = vi.fn().mockResolvedValue('datos');

    const [a, b] = await Promise.all([
      getOrFetch('resumen:2026:anual', fetcher),
      getOrFetch('resumen:2026:anual', fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe('datos');
    expect(b).toBe('datos');
  });

  it('vuelve a consultar pasado el TTL, para no mostrar números viejos', async () => {
    // Regresión: sin TTL, después de cargar una operación el resumen seguía
    // mostrando los valores anteriores hasta recargar la página entera.
    const fetcher = vi.fn().mockResolvedValue('datos');
    await getOrFetch('resumen:ttl', fetcher);

    await vi.advanceTimersByTimeAsync(11_000);
    await getOrFetch('resumen:ttl', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('claves distintas no se pisan', async () => {
    const unoFetcher = vi.fn().mockResolvedValue(1);
    const dosFetcher = vi.fn().mockResolvedValue(2);

    expect(await getOrFetch('k:1', unoFetcher)).toBe(1);
    expect(await getOrFetch('k:2', dosFetcher)).toBe(2);
  });

  it('un error no queda cacheado: el próximo intento reintenta', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('falló')).mockResolvedValueOnce('ok');

    await expect(getOrFetch('k:error', fetcher)).rejects.toThrow('falló');
    expect(await getOrFetch('k:error', fetcher)).toBe('ok');
  });
});

describe('getOrFetch · por persona', () => {
  /** Un JWT de mentira con el `sub` dado (la firma no se mira). */
  const jwt = (sub: string) => `x.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.firma`;

  it('la misma combinación de filtros, pedida por otra persona, no reutiliza lo de la primera', async () => {
    // Un celular compartido: sale Ana, entra Beto, y en los segundos del TTL
    // Beto veía los números de Ana.
    const deAna = vi.fn().mockResolvedValue('de Ana');
    const deBeto = vi.fn().mockResolvedValue('de Beto');

    expect(await getOrFetch('resumen:2026:anual:persona', deAna, jwt('ana'))).toBe('de Ana');
    expect(await getOrFetch('resumen:2026:anual:persona', deBeto, jwt('beto'))).toBe('de Beto');
    expect(deBeto).toHaveBeenCalledTimes(1);
  });

  it('la misma persona con el token renovado sigue compartiendo la consulta', async () => {
    const fetcher = vi.fn().mockResolvedValue('datos');
    await getOrFetch('resumen:2026:renovado', fetcher, jwt('ana'));
    await getOrFetch('resumen:2026:renovado', fetcher, `${jwt('ana')}-renovado`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('alcanceDe toma el sub del token, o el token entero si no es un JWT', () => {
    expect(alcanceDe(jwt('u-123'))).toBe('u-123');
    expect(alcanceDe('no-es-jwt')).toBe('no-es-jwt');
  });
});
