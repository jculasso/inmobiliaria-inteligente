/**
 * Cliente de la API de Tokko Broker.
 *
 * Lo que se verificó contra la cuenta real de Vacker el 30/07/2026:
 *  - La API de propiedades es de SOLO LECTURA: `OPTIONS /api/v1/property/`
 *    responde `allow: GET`. No se puede crear ni actualizar una propiedad acá.
 *  - Para escribir hay otro camino: se le avisa a Tokko dónde está nuestro
 *    archivo con `POST /property_importer/` y él lo va a buscar (ver
 *    `importador.ts` cuando exista).
 *  - Cada propiedad trae `id` —el "DNI" que Tokko le asigna— y
 *    `reference_code`, que es NUESTRO identificador. Ese es el puente: se
 *    publica el código propio y después se lee de vuelta para saber el id.
 *
 * La key va por query param porque así lo define Tokko para esta API (el
 * importador, en cambio, usa el header `Authorization`).
 */

const BASE = 'https://www.tokkobroker.com/api/v1';

export interface PropiedadTokko {
  id: number;
  reference_code: string | null;
  publication_title: string | null;
  public_url: string | null;
  created_at: string | null;
  status: string | number | null;
  address: string | null;
  type: { id: number; name: string } | null;
  location: { id: number; short_location: string | null } | null;
  operations: { operation_type: string; prices: { currency: string; price: number }[] }[] | null;
  photos: { image: string; is_front_cover: boolean }[] | null;
  producer: { id: number; name: string | null; email: string | null } | null;
}

export interface RespuestaListado {
  totalCount: number;
  propiedades: PropiedadTokko[];
}

/** Error con un mensaje que le sirve a quien está configurando, no al log. */
export class TokkoError extends Error {}

async function pedir(path: string, key: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lang', 'es_ar');
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    // Timeout explícito: sin esto, una demora de Tokko cuelga el request
    // nuestro hasta que el navegador se cansa, y el usuario no sabe si falló.
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new TokkoError(
      e instanceof Error && e.name === 'TimeoutError'
        ? 'Tokko no respondió en 20 segundos.'
        : 'No se pudo conectar con Tokko.',
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new TokkoError('Tokko rechazó la clave. Verificá que sea la correcta y que esté activa.');
  }
  if (!res.ok) {
    throw new TokkoError(`Tokko respondió ${res.status}.`);
  }
  return res.json() as Promise<unknown>;
}

/**
 * Trae un listado de propiedades. Con `limit: 1` sirve como prueba de conexión:
 * el `total_count` de la respuesta dice cuántas ve la cuenta, que es lo que le
 * confirma al usuario que cargó la clave de la inmobiliaria correcta.
 */
export async function listarPropiedades(
  key: string,
  limit = 1,
  offset = 0,
): Promise<RespuestaListado> {
  const data = (await pedir('/property/', key, {
    limit: String(limit),
    offset: String(offset),
  })) as { meta?: { total_count?: number }; objects?: PropiedadTokko[] };
  return {
    totalCount: data.meta?.total_count ?? 0,
    propiedades: data.objects ?? [],
  };
}

/**
 * Las N propiedades más recientes.
 *
 * Tokko NO soporta `order_by` —devuelve un error— pero su orden natural es por
 * fecha de creación ascendente, así que las últimas están al final. Se pide el
 * total con una consulta mínima y se salta hasta ahí.
 *
 * Cuesta dos llamadas en vez de una; la alternativa sería traer las 387 para
 * quedarse con 10.
 */
export async function ultimasPropiedades(key: string, cuantas: number): Promise<PropiedadTokko[]> {
  const { totalCount } = await listarPropiedades(key, 1);
  if (totalCount === 0) return [];
  const offset = Math.max(0, totalCount - cuantas);
  const { propiedades } = await listarPropiedades(key, cuantas, offset);
  // De más nueva a más vieja, que es como se quiere mirar la lista.
  return [...propiedades].reverse();
}
