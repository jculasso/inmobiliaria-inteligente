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

/**
 * De quién es la sesión, para que la clave la incluya: la cache vive en el
 * módulo, y si en el mismo navegador sale una persona y entra otra (un celular
 * compartido en la oficina) dentro de los segundos del TTL, la segunda veía los
 * números de la primera. Es el `sub` del JWT de Supabase; si el token no se
 * puede leer, el token entero (igual distingue a una sesión de otra).
 */
export function alcanceDe(accessToken: string): string {
  try {
    const payload = accessToken.split('.')[1] ?? '';
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub?: unknown;
    };
    if (typeof json.sub === 'string' && json.sub) return json.sub;
  } catch {
    // Un token que no es JWT: cae al token entero.
  }
  return accessToken;
}

/**
 * `accessToken` acota la entrada a la persona de la sesión (ver `alcanceDe`):
 * la misma combinación de filtros devuelve cosas distintas según quién la pide.
 */
export function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  accessToken?: string,
): Promise<T> {
  if (accessToken !== undefined) key = `${alcanceDe(accessToken)}|${key}`;
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
