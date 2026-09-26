/**
 * Cache mínima a nivel de módulo para no repetir la misma combinación de
 * anio/periodo/mes/trimestre cuando se va y se vuelve entre pestañas.
 *
 * Nació para otra cosa: que `ResumenAcumulado` y `RankingTable` no pidieran lo
 * mismo al montar a la vez. El Ranking se quitó el 25/09/2026 —era el mismo
 * dato dos veces— y la cache se quedó, porque ir de Anual a Trimestral y volver
 * seguía disparando la consulta de nuevo.
 *
 * Tiene TTL corto a propósito. Sin él la entrada vivía hasta el próximo reload
 * completo, así que después de cargar o editar una operación el resumen seguía
 * mostrando los números viejos, sin ninguna pista de que estaban desactualizados.
 * Unos segundos alcanzan para el único objetivo real: que dos componentes que
 * montan a la vez no disparen la misma consulta dos veces.
 */
const TTL_MS = 10_000;

const cache = new Map<string, { promesa: Promise<unknown>; expira: number }>();

export function getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expira > Date.now()) return hit.promesa as Promise<T>;

  const promesa = fetcher().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { promesa, expira: Date.now() + TTL_MS });
  purgarVencidas();
  return promesa;
}

/** Descarta lo vencido: la cache es chica, pero no tiene por qué crecer sin fin. */
function purgarVencidas(): void {
  const ahora = Date.now();
  for (const [key, valor] of cache) {
    if (valor.expira <= ahora) cache.delete(key);
  }
}
