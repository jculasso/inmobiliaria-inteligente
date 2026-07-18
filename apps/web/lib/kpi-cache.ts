/**
 * Cache mínima a nivel de módulo para evitar que dos componentes independientes
 * (`ResumenAcumulado` y `RankingTable`) pidan la misma combinación de
 * anio/periodo/mes/trimestre al montar con los mismos valores por defecto.
 * Vive solo en memoria del cliente — se recrea en cada full reload, no hace
 * falta invalidarla a mano.
 */
const cache = new Map<string, Promise<unknown>>();

export function getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;
  const promise = fetcher().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  return promise;
}
