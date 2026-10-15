import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '@prisma/client';
import type { PoolConfig } from 'pg';

/**
 * Cómo habla la API con Postgres.
 *
 * - **`pg`** (por defecto): el adaptador de Prisma sobre node-postgres. Cada
 *   consulta va en UN viaje (Parse/Bind/Execute en el mismo paquete, con un
 *   statement sin nombre), así que funciona detrás del pooler de Supabase en
 *   modo transaction sin `pgbouncer=true`.
 * - **`motor`**: el motor propio de Prisma, como hasta octubre de 2026. Con
 *   `?pgbouncer=true` manda `DEALLOCATE ALL` en cada transacción y paga dos
 *   viajes por consulta (preparar y ejecutar). Queda como vuelta atrás:
 *   `DATABASE_CONECTOR=motor` en Render y reiniciar, sin desplegar nada.
 *
 * Medido con la cartera de Vacker de prueba y 150 ms de ida y vuelta (la
 * distancia entre Render, en Oregon, y Supabase, en São Paulo): ver
 * `scripts/perf/` y el PR que hizo el cambio.
 */
export type Conector = 'pg' | 'motor';

/** `DATABASE_CONECTOR`: todo lo que no sea «motor» es el adaptador. */
export function conectorDelEntorno(env: NodeJS.ProcessEnv = process.env): Conector {
  return env.DATABASE_CONECTOR?.trim().toLowerCase() === 'motor' ? 'motor' : 'pg';
}

/**
 * Conexiones del pool cuando nadie dice otra cosa. Un pedido del Dashboard
 * abre tres transacciones a la vez (la lectura, la bandeja de indexación y las
 * liquidaciones pendientes); diez alcanzan para tres pantallas pesadas en
 * paralelo sin acercarse al tope del pooler de Supabase (15 conexiones a la
 * base y 200 clientes en el plan gratuito).
 */
export const MAX_CONEXIONES_POR_DEFECTO = 10;

/**
 * Parámetros de la URL que entiende el motor de Prisma y no node-postgres.
 * Se sacan antes de dársela al pool: `sslmode` porque node-postgres lo
 * interpreta distinto (ver `ssl` abajo) y el resto porque no significan nada
 * para él. `connection_limit` y `pool_timeout` se respetan: se traducen.
 */
const SOLO_DEL_MOTOR = [
  'pgbouncer',
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
  'socket_timeout',
  'statement_cache_size',
  'schema',
  'sslmode',
  'sslaccept',
  'sslcert',
  'sslidentity',
  'sslpassword',
] as const;

const HOSTS_LOCALES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const enteroPositivo = (x: unknown): number | undefined => {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * La configuración del pool de node-postgres a partir de la misma
 * `DATABASE_URL` que usaba el motor. No hace falta tocar la variable en
 * Render para pasar de uno al otro.
 */
export function configDelPool(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig & { schema?: string } {
  const u = new URL(url);
  const q = u.searchParams;
  const limiteDeLaUrl = q.get('connection_limit');
  const esperaDeLaUrl = q.get('pool_timeout');
  const sslmode = q.get('sslmode');
  const schema = q.get('schema') ?? undefined;
  for (const p of SOLO_DEL_MOTOR) q.delete(p);
  return {
    connectionString: u.toString(),
    max:
      enteroPositivo(env.DATABASE_POOL_MAX) ??
      enteroPositivo(limiteDeLaUrl) ??
      MAX_CONEXIONES_POR_DEFECTO,
    // Lo que espera un pedido por una conexión libre (o por abrir una), como
    // el `pool_timeout` de Prisma: 10 s, en segundos en la URL.
    connectionTimeoutMillis: (enteroPositivo(esperaDeLaUrl) ?? 10) * 1000,
    // Una conexión ociosa se cierra a los 30 s: Render duerme la API y el
    // pooler corta los sockets quietos; mejor abrir una nueva que encontrar
    // una muerta.
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    // El motor usa `sslmode=prefer` por defecto: cifra, pero no verifica el
    // certificado. node-postgres sin `ssl` NO cifra, y con `sslmode=require`
    // en la URL exige verificar (el certificado del pooler no es de una
    // autoridad pública). Se replica lo del motor: cifrado siempre que la base
    // no sea local, sin verificar la cadena.
    ssl:
      HOSTS_LOCALES.has(u.hostname) || sslmode === 'disable'
        ? false
        : { rejectUnauthorized: false },
    schema: schema && schema !== 'public' ? schema : undefined,
  };
}

/** Las opciones del `PrismaClient` según el conector. */
export function opcionesDelCliente(
  url: string | undefined,
  conector: Conector,
  log?: Prisma.PrismaClientOptions['log'],
  env: NodeJS.ProcessEnv = process.env,
): Prisma.PrismaClientOptions {
  if (conector === 'motor') return { ...(url ? { datasourceUrl: url } : {}), log };
  if (!url) throw new Error('Falta DATABASE_URL: sin ella no hay a qué base conectarse.');
  const { schema, ...pool } = configDelPool(url, env);
  return {
    adapter: new PrismaPg(pool, {
      schema,
      // Una conexión ociosa que la base o el pooler cortaron: el pool la
      // descarta solo. Se anota para que se vea en los logs de Render.
      onPoolError: (e) => console.warn(`[db] se cerró una conexión ociosa: ${e.message}`),
    }),
    log,
  };
}
