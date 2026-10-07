import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch, apiFetchArchivo, apiFetchForm, ApiError } from './api-client';

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

  // Prueba en producción, 6/10/2026: «cuit: El CUIT/CUIL no es válido…».
  it('un error de validación muestra el mensaje, sin la clave del campo delante', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'bad_request',
            message: 'Error de validación.',
            details: [{ path: 'cuit', message: 'El CUIT/CUIL no es válido: revisá los números.' }],
          },
        }),
      }),
    );
    const error = await apiFetch('/alquileres/personas', schema, { accessToken: 't' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as Error).message).toBe('El CUIT/CUIL no es válido: revisá los números.');
  });

  it('un detalle con el mensaje de Zod en inglés se dice en castellano', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'bad_request',
            message: 'Error de validación.',
            details: [{ path: 'tramos', message: 'Array must contain at least 1 element(s)' }],
          },
        }),
      }),
    );
    await expect(apiFetch('/x', schema, { accessToken: 't' })).rejects.toThrow(/^Revisá los datos/);
  });

  it('lanza ApiError si el body no matchea el schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(
      apiFetch('/tablero/operaciones', schema, { accessToken: 't' }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiFetchForm', () => {
  it('manda los campos junto al archivo, con el método pedido', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['PK'], 'Contrato.docx');
    await apiFetchForm('/alquileres/plantillas/p1/archivo', schema, {
      accessToken: 't',
      file,
      campos: { nombre: 'Locación', tipoContrato: '' },
      method: 'PUT',
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('PUT');
    const form = init.body as FormData;
    expect(form.get('nombre')).toBe('Locación');
    expect(form.get('tipoContrato')).toBe('');
    expect((form.get('file') as File).name).toBe('Contrato.docx');
  });
});

describe('apiFetchArchivo', () => {
  it('devuelve los bytes y el nombre completo, con acentos y extensión', async () => {
    const blob = new Blob(['PK']);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => blob,
        headers: new Headers({
          'content-disposition':
            'attachment; filename="Contrato Pe_a.docx"; filename*=UTF-8\'\'Contrato%20Pe%C3%B1a.docx',
        }),
      }),
    );
    expect(await apiFetchArchivo('/x', { accessToken: 't' })).toEqual({
      blob,
      nombre: 'Contrato Peña.docx',
    });
  });

  it('un error de la API llega con su mensaje', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 'bad_request', message: 'La plantilla no existe.' } }),
      }),
    );
    await expect(apiFetchArchivo('/x', { accessToken: 't', method: 'POST' })).rejects.toThrow(
      'La plantilla no existe.',
    );
  });
});
