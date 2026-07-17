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
  error?: { code?: string; message?: string };
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
    throw new ApiError(errorBody?.error?.message ?? `${method} ${path} devolvió ${res.status}`, {
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
