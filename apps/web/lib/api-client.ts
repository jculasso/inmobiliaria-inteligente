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

/** Formato de error de la API (CLAUDE.md §8): { error: { code, message, details? } }. */
interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: { path?: string; message: string }[] };
}

/** Arma un mensaje legible a partir del error de la API, priorizando el detalle de validación por campo. */
function mensajeDeError(errorBody: ApiErrorBody | null, fallback: string): string {
  const detalle = errorBody?.error?.details?.[0];
  if (detalle) return detalle.path ? `${detalle.path}: ${detalle.message}` : detalle.message;
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
    throw new ApiError(`La respuesta de ${method} ${path} no tiene el formato esperado.`);
  }
  return parsed.data;
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
    throw new ApiError(`La respuesta de POST ${path} no tiene el formato esperado.`);
  }
  return parsed.data;
}
