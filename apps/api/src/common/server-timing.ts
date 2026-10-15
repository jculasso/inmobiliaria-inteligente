import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * La cabecera `Server-Timing` de cada respuesta de la API:
 *
 *   Server-Timing: db;dur=812.4;desc="base", total;dur=905.1
 *
 * - `total`: desde que llegó el pedido hasta que salen las cabeceras.
 * - `db`: el tiempo con al menos una transacción de `withTenant` abierta —
 *   incluye los viajes de red a São Paulo—. Si un pedido abre tres a la vez
 *   (el Dashboard), cuenta el lapso, no la suma de las tres.
 *
 * La diferencia es lo que hace la API: armar, calcular, el PDF. Sirve para
 * medir en Render sin instrumentar nada: el navegador la muestra en la pestaña
 * Red (Timing) y `curl -sD - -o /dev/null` la imprime.
 *
 * No cubre las consultas fuera de `withTenant` (el panel de plataforma y la
 * identidad del guard, que está en caché).
 */
interface Medicion {
  inicio: number;
  db: number;
  abiertas: number;
  desde: number;
}

const medicion = new AsyncLocalStorage<Medicion>();

export function cabeceraServerTiming(m: Medicion, ahora = performance.now()): string {
  const db = m.db + (m.abiertas > 0 ? ahora - m.desde : 0);
  return `db;dur=${db.toFixed(1)};desc="base", total;dur=${(ahora - m.inicio).toFixed(1)}`;
}

/**
 * Middleware de Express: abre la medición del pedido y escribe la cabecera
 * justo antes de que salgan las cabeceras (el mismo truco que `on-headers`).
 */
export function serverTiming(
  _req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): void {
  const m: Medicion = { inicio: performance.now(), db: 0, abiertas: 0, desde: 0 };
  const writeHead = res.writeHead;
  res.writeHead = function (this: ServerResponse, ...args: unknown[]) {
    if (!this.headersSent) this.setHeader('Server-Timing', cabeceraServerTiming(m));
    return (writeHead as (...a: unknown[]) => ServerResponse).apply(this, args);
  } as ServerResponse['writeHead'];
  medicion.run(m, next);
}

/** Corre `fn` contando su tiempo como de base de datos del pedido en curso. */
export async function medirDb<T>(fn: () => Promise<T>): Promise<T> {
  const m = medicion.getStore();
  if (!m) return fn();
  if (m.abiertas++ === 0) m.desde = performance.now();
  try {
    return await fn();
  } finally {
    if (--m.abiertas === 0) m.db += performance.now() - m.desde;
  }
}
