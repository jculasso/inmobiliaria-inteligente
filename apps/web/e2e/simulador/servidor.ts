import http from 'node:http';
import { PUERTO_API, PUERTO_AUTH, escenarioDe, usuarioSupabase } from './identidad';
import { estadoDe } from './estado';
import { RUTAS, type RespuestaSimulada, type Ruta } from './rutas';

/**
 * El simulador de la API y de Supabase para las pruebas de navegador con sesión.
 *
 * Por qué existe: las páginas de la app piden sus datos DESDE EL SERVIDOR de
 * Next (Server Components), así que interceptar pedidos en el navegador no
 * alcanza. La web de prueba se compila apuntando acá (`entorno-de-prueba.env`)
 * y este proceso contesta con datos de mentira, validados contra los mismos
 * schemas Zod que usa la app. Ninguna prueba puede llegar a la base real.
 *
 * Dos puertos:
 *  - API (`NEXT_PUBLIC_API_URL`): las rutas de `rutas.ts`.
 *  - Auth (`NEXT_PUBLIC_SUPABASE_URL`): solo `/auth/v1/user`, que es lo que
 *    consulta el middleware para dar por buena la sesión.
 *
 * Un pedido que nadie simula contesta 404 y queda escrito en la salida: es la
 * pista para sumar la ruta que falta.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Disposition',
};

function enviar(
  res: http.ServerResponse,
  status: number,
  cuerpo: unknown,
  headers: Record<string, string> = {},
) {
  if (cuerpo instanceof Buffer) {
    res.writeHead(status, { ...CORS, ...headers });
    res.end(cuerpo);
    return;
  }
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', ...headers });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}

function esSimulada(x: unknown): x is RespuestaSimulada {
  return typeof x === 'object' && x !== null && 'simulada' in x;
}

async function leerCuerpo(req: http.IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = [];
  for await (const p of req) partes.push(p as Buffer);
  const texto = Buffer.concat(partes).toString('utf8');
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return texto; // multipart: no hace falta entenderlo
  }
}

/** `/alquileres/contratos/:id` → expresión regular con grupos nombrados. */
function compilar(patron: string): RegExp {
  const cuerpo = patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '(?<$1>[^/]+)');
  return new RegExp(`^${cuerpo}$`);
}

const COMPILADAS = RUTAS.map((r) => ({ ...r, re: compilar(r.patron) }));

function buscar(metodo: string, ruta: string): { r: Ruta; params: Record<string, string> } | null {
  for (const c of COMPILADAS) {
    if (c.metodo !== metodo) continue;
    const m = c.re.exec(ruta);
    if (m) return { r: c, params: { ...(m.groups ?? {}) } };
  }
  return null;
}

const api = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PUERTO_API}`);
  const metodo = req.method ?? 'GET';
  if (metodo === 'OPTIONS') return enviar(res, 204, undefined);
  if (url.pathname === '/__simulador') return enviar(res, 200, { simulador: true });

  const encontrada = buscar(metodo, url.pathname);
  if (!encontrada) {
    console.error(`[simulador] SIN SIMULAR: ${metodo} ${url.pathname}${url.search}`);
    return enviar(res, 404, {
      error: {
        code: 'NO_SIMULADO',
        message: `El simulador no conoce ${metodo} ${url.pathname}`,
      },
    });
  }
  const { r, params } = encontrada;
  try {
    const body = await leerCuerpo(req);
    const estado = estadoDe(escenarioDe(req.headers.authorization));
    const salida = await r.responder({ params, query: url.searchParams, body, estado });
    if (esSimulada(salida)) return enviar(res, salida.status, salida.cuerpo, salida.headers);
    // Lo que sale se valida con el schema de la app: un dato de prueba que no
    // lo cumple es un dato de prueba mal armado, y conviene saberlo acá y no
    // como «no tiene el formato esperado» en la pantalla.
    const validada = r.schema ? r.schema.parse(salida) : salida;
    return enviar(res, 200, validada);
  } catch (err) {
    console.error(`[simulador] ERROR en ${metodo} ${url.pathname}:`, err);
    return enviar(res, 500, {
      error: { code: 'SIMULADOR', message: `El simulador falló en ${metodo} ${url.pathname}` },
    });
  }
});

const auth = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PUERTO_AUTH}`);
  if (req.method === 'OPTIONS') return enviar(res, 204, undefined);
  if (url.pathname === '/auth/v1/user') return enviar(res, 200, usuarioSupabase());
  if (url.pathname === '/auth/v1/logout') return enviar(res, 204, undefined);
  console.error(`[simulador] SIN SIMULAR (auth): ${req.method} ${url.pathname}`);
  return enviar(res, 404, { error: 'no simulado' });
});

api.listen(PUERTO_API, () => console.log(`[simulador] API en http://localhost:${PUERTO_API}`));
auth.listen(PUERTO_AUTH, () => console.log(`[simulador] Auth en http://localhost:${PUERTO_AUTH}`));
