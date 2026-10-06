import { describe, expect, it, vi } from 'vitest';
import {
  MENSAJE_DEMORA,
  MENSAJE_GENERICO,
  MENSAJE_SIN_CONEXION,
  enviarConsulta,
} from './enviar-consulta';

const respuesta = (status: number, cuerpo?: unknown) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status });

describe('enviarConsulta', () => {
  it('envía los datos al endpoint y devuelve ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, { ok: true }));
    const r = await enviarConsulta({ nombre: 'Ana' }, { fetchImpl });
    expect(r).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/contacto',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ nombre: 'Ana' }) }),
    );
  });

  it('sin conexión, un mensaje en castellano y no el «Failed to fetch» del navegador', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await enviarConsulta({}, { fetchImpl });
    expect(r).toEqual({ ok: false, mensaje: MENSAJE_SIN_CONEXION });
    expect(JSON.stringify(r)).not.toMatch(/fetch/i);
  });

  it('si la red no contesta, corta y avisa en vez de quedarse «Enviando…»', async () => {
    // Un fetch que solo termina cuando lo abortan, como una red colgada.
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, rechazar) => {
          init?.signal?.addEventListener('abort', () =>
            rechazar(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;
    const r = await enviarConsulta({}, { fetchImpl, tiempoMaximoMs: 10 });
    expect(r).toEqual({ ok: false, mensaje: MENSAJE_DEMORA });
  });

  it('un error del endpoint muestra su mensaje, que ya viene en castellano', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(respuesta(400, { mensaje: 'Revisá los datos del formulario.' }));
    expect(await enviarConsulta({}, { fetchImpl })).toEqual({
      ok: false,
      mensaje: 'Revisá los datos del formulario.',
    });
  });

  it('un error sin cuerpo legible cae al mensaje genérico', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    expect(await enviarConsulta({}, { fetchImpl })).toEqual({
      ok: false,
      mensaje: MENSAJE_GENERICO,
    });
  });
});
