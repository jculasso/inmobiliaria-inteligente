import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch, ApiError } from './api-client';

const schema = z.object({ id: z.string() });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('arma la URL con query params y el Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'abc' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/tablero/operaciones', schema, {
      accessToken: 'token-123',
      searchParams: { anio: 2026, mes: undefined },
    });

    expect(result).toEqual({ id: 'abc' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:3001/tablero/operaciones?anio=2026');
    expect(init).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer token-123' } });
  });

  it('manda body y Content-Type en POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/tablero/operaciones', schema, {
      accessToken: 't',
      method: 'POST',
      body: { direccion: 'Calle 123' },
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ direccion: 'Calle 123' }));
  });

  it('lanza ApiError con el mensaje del backend cuando la respuesta no es ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: 'forbidden', message: 'No tenés permisos.' } }),
      }),
    );

    await expect(apiFetch('/tablero/vendedores', schema, { accessToken: 't' })).rejects.toThrow(
      'No tenés permisos.',
    );
  });

  it('lanza ApiError si el body no matchea el schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(apiFetch('/tablero/operaciones', schema, { accessToken: 't' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
