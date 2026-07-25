import type { ZodType } from 'zod';

export class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.status = opts?.status;
    this.code = opts?.code;
  }
}

interface ApiFetchOptions {
  accessToken: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

/**
 * Formato de error de la API (CLAUDE.md §8): { error: { code, message, details? } }.
 * `details` viaja tipado como `unknown` a propósito: la validación Zod lo manda
 * como `{ path, message }[]`, pero errores de Prisma (p. ej. P2002) lo mandan
 * como `string[]` — no se puede asumir una sola forma.
 */
interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/** Detalle de validación por campo (forma que emite ZodValidationPipe). */
function esDetalleCampo(x: unknown): x is { path?: string; message: string } {
  return typeof x === 'object' && x !== null && typeof (x as { message?: unknown }).message === 'string';
}

/** Arma un mensaje legible a partir del error de la API, priorizando el detalle de validación por campo. */
function mensajeDeError(errorBody: ApiErrorBody | null, fallback: string): string {
  const detalles = errorBody?.error?.details;
  const detalle = Array.isArray(detalles) ? detalles[0] : undefined;
  // Solo usamos el detalle si es un error de validación por campo; para otros
  // (Prisma manda `details` como string[]) caemos al mensaje genérico en vez
  // de renderizar `undefined`.
  if (esDetalleCampo(detalle)) {
    return detalle.path ? `${detalle.path}: ${detalle.message}` : detalle.message;
  }
  return errorBody?.error?.message ?? fallback;
}

/** Cliente HTTP tipado contra apps/api, con validación de respuesta vía Zod. */
export async function apiFetch<T>(
  path: string,
  schema: ZodType<T>,
  { accessToken, method = 'GET', body, searchParams }: ApiFetchOptions,
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new ApiError('Falta NEXT_PUBLIC_API_URL en el entorno.');
  }

  const url = new URL(`${apiUrl}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(mensajeDeError(errorBody, `${method} ${path} devolvió ${res.status}`), {
      status: res.status,
      code: errorBody?.error?.code,
    });
  }

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(`La respuesta de ${method} ${path} no tiene el formato esperado.${detalleZod(parsed.error)}`);
  }
  return parsed.data;
}

/** Primer issue de Zod como `[campo: mensaje]` — para no quedar a ciegas ante un drift de datos. */
function detalleZod(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  if (!issue) return '';
  const campo = issue.path.map(String).join('.') || 'root';
  return ` [${campo}: ${issue.message}]`;
}

/** Variante de `apiFetch` para subir un archivo (`multipart/form-data`) — sin forzar `Content-Type: json`. */
export async function apiFetchForm<T>(
  path: string,
  schema: ZodType<T>,
  { accessToken, file }: { accessToken: string; file: File },
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new ApiError('Falta NEXT_PUBLIC_API_URL en el entorno.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(mensajeDeError(errorBody, `POST ${path} devolvió ${res.status}`), {
      status: res.status,
      code: errorBody?.error?.code,
    });
  }

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(`La respuesta de POST ${path} no tiene el formato esperado.${detalleZod(parsed.error)}`);
  }
  return parsed.data;
}

/** PDF listo para mostrar: los bytes y el nombre con el que debe guardarse. */
export interface PdfGenerado {
  blob: Blob;
  /** Sin extensión, tal como lo arma la API (ej. "Tasacion Vacker - Juan - Córdoba 1234"). */
  nombre: string;
}

/**
 * Variante de `apiFetch` para endpoints que devuelven un PDF. La API manda los
 * bytes en la respuesta (no una URL a Storage), así que se lee como Blob.
 *
 * El nombre viaja en `Content-Disposition` y se devuelve aparte: una URL
 * `blob:` es opaca, así que si no se rescata acá, el archivo termina guardado
 * con un identificador al azar en vez del nombre del informe.
 */
export async function apiFetchPdf(
  path: string,
  { accessToken, searchParams }: { accessToken: string; searchParams?: Record<string, string | number | undefined> },
): Promise<PdfGenerado> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new ApiError('Falta NEXT_PUBLIC_API_URL en el entorno.');
  }

  const url = new URL(`${apiUrl}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(mensajeDeError(errorBody, `No se pudo generar el PDF (${res.status}).`), {
      status: res.status,
      code: errorBody?.error?.code,
    });
  }
  return { blob: await res.blob(), nombre: nombreDeDisposition(res.headers.get('content-disposition')) };
}

/**
 * Lee el nombre del header `Content-Disposition`. Prioriza `filename*`
 * (RFC 5987), que es el que lleva acentos y ñ; `filename` es el respaldo ASCII.
 */
function nombreDeDisposition(header: string | null): string {
  const fallback = 'Informe';
  if (!header) return fallback;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]).replace(/\.pdf$/i, '');
    } catch {
      // Header mal formado: se sigue con el respaldo de abajo.
    }
  }

  const ascii = /filename="([^"]+)"/i.exec(header);
  return ascii?.[1]?.replace(/\.pdf$/i, '') ?? fallback;
}
