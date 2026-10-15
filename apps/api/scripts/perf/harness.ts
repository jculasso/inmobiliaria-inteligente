import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { proxyConLatencia } from './proxy-latencia';

/**
 * El arnés de la prueba de volumen de Alquileres: levanta la API entera
 * (AppModule) contra una base LOCAL, con un proveedor de identidad falso, el
 * Storage en memoria y sin límite de pedidos, y cuenta cada consulta que Prisma
 * manda a la base (cada una es un viaje de red: en producción, ~150 ms entre
 * Oregon y São Paulo).
 *
 * NUNCA contra la base productiva: la URL sale de `PERF_DATABASE_URL` y tiene
 * que apuntar a 127.0.0.1 / localhost. Una URL de Supabase corta en seco.
 */

const HOSTS_LOCALES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function urlLocal(): string {
  const url = process.env.PERF_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta PERF_DATABASE_URL: una base Postgres LOCAL y descartable (127.0.0.1 o localhost).',
    );
  }
  const host = new URL(url).hostname;
  if (/supabase/i.test(url) || !HOSTS_LOCALES.has(host)) {
    throw new Error(
      `PERF_DATABASE_URL apunta a «${host}». Esta prueba siembra miles de filas: solo una base local.`,
    );
  }
  return url;
}

export interface Contador {
  consultas: number;
  sql: string[];
}

export interface Respuesta {
  status: number;
  ms: number;
  /** CPU de este proceso (Node + motor de Prisma) durante el pedido, en ms. */
  cpu: number;
  consultas: number;
  bytes: number;
  gzip: number;
  json: unknown;
  sql: string[];
}

export interface Api {
  app: INestApplication;
  contador: Contador;
  pedir: (metodo: string, ruta: string, cuerpo?: unknown, token?: string) => Promise<Respuesta>;
  subir: (
    ruta: string,
    campos: Record<string, string>,
    archivo: Buffer,
    nombre: string,
    metodo?: string,
  ) => Promise<Respuesta>;
  cerrar: () => Promise<void>;
}

/** Storage de Supabase en memoria: la prueba no sale a la red. */
class StorageEnMemoria {
  private readonly archivos = new Map<string, Buffer>();
  async upload(bucket: string, path: string, buffer: Buffer) {
    this.archivos.set(`${bucket}/${path}`, buffer);
    return `http://127.0.0.1/${bucket}/${path}`;
  }
  async uploadPrivado(bucket: string, path: string, buffer: Buffer) {
    this.archivos.set(`${bucket}/${path}`, buffer);
  }
  async descargarPrivado(bucket: string, path: string) {
    const b = this.archivos.get(`${bucket}/${path}`);
    if (!b) throw new Error(`No existe ${bucket}/${path}`);
    return b;
  }
  async signedUrl(bucket: string, path: string) {
    return `http://127.0.0.1/${bucket}/${path}`;
  }
  async remove(bucket: string, path: string) {
    this.archivos.delete(`${bucket}/${path}`);
  }
}

export async function levantarApi(tokenPorDefecto: () => string): Promise<Api> {
  const url = urlLocal();
  // `PERF_RTT_MS`: la API habla con la base a través de un proxy que le
  // agrega esa latencia (150 = Render en Oregon contra Supabase en São Paulo).
  // `PERF_PGBOUNCER=1` le suma `?pgbouncer=true`, como la URL de producción.
  const rtt = Number(process.env.PERF_RTT_MS ?? 0);
  const proxy =
    rtt > 0
      ? await proxyConLatencia(
          0,
          { host: new URL(url).hostname, port: Number(new URL(url).port || 5432) },
          rtt,
        )
      : null;
  const apiUrl = new URL(url);
  if (proxy) apiUrl.port = String((proxy.address() as AddressInfo).port);
  if (process.env.PERF_PGBOUNCER === '1') apiUrl.searchParams.set('pgbouncer', 'true');
  const urlApi = apiUrl.toString();
  // Todo lo que la API leería del entorno, explícito: así un `.env` que ande
  // cerca no aporta ni una variable (ConfigModule no pisa lo que ya está).
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: urlApi,
    DIRECT_URL: url,
    SUPABASE_URL: 'http://127.0.0.1:9',
    SUPABASE_ANON_KEY: 'prueba',
    SUPABASE_SERVICE_ROLE_KEY: 'prueba',
    RESEND_API_KEY: '',
    // Claves inventadas, de un solo uso: la prueba no cifra nada que importe.
    INTEGRACIONES_ENC_KEY: randomBytes(32).toString('base64'),
    GOOGLE_TOKEN_ENC_KEY: randomBytes(32).toString('base64'),
    FIRMA_PROVEEDOR: '',
  });

  const { Test } = await import('@nestjs/testing');
  const { getStorageToken } = await import('@nestjs/throttler');
  const { AppModule } = await import('../../src/app.module');
  const { PrismaService } = await import('../../src/prisma/prisma.service');
  const { AUTH_PROVIDER } = await import('../../src/auth/auth-provider.interface');
  const { SupabaseStorageService } = await import('../../src/common/supabase-storage.service');
  const { AllExceptionsFilter } = await import('../../src/common/all-exceptions.filter');

  const contador: Contador = { consultas: 0, sql: [] };
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    // El token ES el auth_user_id: el AuthGuard real resuelve tenant y roles.
    .overrideProvider(AUTH_PROVIDER)
    .useValue({ verifyToken: async (t: string) => ({ userId: t, email: 'perf@ejemplo.test' }) })
    .overrideProvider(SupabaseStorageService)
    .useValue(new StorageEnMemoria())
    .overrideProvider(getStorageToken())
    .useValue({
      increment: async () => ({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
    .overrideProvider(PrismaService)
    .useFactory({
      factory: () => {
        // El conector de la API (`src/prisma/conexion.ts`): `PERF_CONECTOR=motor`
        // mide el motor de Prisma; si no, el adaptador de node-postgres.
        const p = new PrismaService({
          url: urlApi,
          conector: process.env.PERF_CONECTOR === 'motor' ? 'motor' : 'pg',
          log: [{ emit: 'event', level: 'query' }],
        });
        (p as unknown as { $on: (e: string, f: (q: { query: string }) => void) => void }).$on(
          'query',
          (q) => {
            contador.consultas++;
            contador.sql.push(q.query);
          },
        );
        return p;
      },
    })
    .compile();

  const app = modulo.createNestApplication({ logger: ['error', 'warn'] });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  async function leer(
    res: Response,
    inicio: number,
    antes: number,
    cpu0: NodeJS.CpuUsage,
  ): Promise<Respuesta> {
    const buf = Buffer.from(await res.arrayBuffer());
    const ms = performance.now() - inicio;
    const c = process.cpuUsage(cpu0);
    const tipo = res.headers.get('content-type') ?? '';
    let json: unknown = null;
    if (tipo.includes('json') && buf.length) json = JSON.parse(buf.toString('utf8'));
    return {
      status: res.status,
      ms,
      cpu: (c.user + c.system) / 1000,
      consultas: contador.consultas - antes,
      bytes: buf.length,
      gzip: tipo.includes('json') ? gzipSync(buf).length : buf.length,
      json,
      sql: contador.sql.slice(antes),
    };
  }

  const pedir: Api['pedir'] = async (metodo, ruta, cuerpo, token) => {
    const antes = contador.consultas;
    const cpu0 = process.cpuUsage();
    const inicio = performance.now();
    const res = await fetch(base + ruta, {
      method: metodo,
      signal: AbortSignal.timeout(120_000),
      headers: {
        authorization: `Bearer ${token ?? tokenPorDefecto()}`,
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    return leer(res, inicio, antes, cpu0);
  };

  const subir: Api['subir'] = async (ruta, campos, archivo, nombre, metodo = 'POST') => {
    const form = new FormData();
    for (const [k, v] of Object.entries(campos)) form.append(k, v);
    form.append(
      'file',
      new Blob([archivo], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      nombre,
    );
    const antes = contador.consultas;
    const cpu0 = process.cpuUsage();
    const inicio = performance.now();
    const res = await fetch(base + ruta, {
      method: metodo,
      signal: AbortSignal.timeout(120_000),
      headers: { authorization: `Bearer ${tokenPorDefecto()}` },
      body: form,
    });
    return leer(res, inicio, antes, cpu0);
  };

  return {
    app,
    contador,
    pedir,
    subir,
    cerrar: async () => {
      await app.close();
      proxy?.close();
    },
  };
}

/** Falla con el cuerpo de la respuesta si no es 2xx. */
export function ok<T = unknown>(r: Respuesta, que: string): T {
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${que}: HTTP ${r.status} ${JSON.stringify(r.json)?.slice(0, 600)}`);
  }
  return r.json as T;
}
