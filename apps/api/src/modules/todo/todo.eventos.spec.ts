import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../prisma/tenant-context';
import { encriptarSecreto } from '../../common/cripto-secreto';
import { GoogleService, MAX_PAGINAS, TokenDeGoogleRechazado } from './google.service';
import { TodoService } from './todo.service';

const CLAVE = Buffer.alloc(32, 7).toString('base64');
const CTX: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['vendedor'] };

function config() {
  return {
    get: (k: string) =>
      ({
        GOOGLE_TOKEN_ENC_KEY: CLAVE,
        GOOGLE_OAUTH_CLIENT_ID: 'id',
        GOOGLE_OAUTH_CLIENT_SECRET: 'secreto',
        GOOGLE_OAUTH_REDIRECT_URI: 'https://api.test/todo/google/callback',
      })[k],
  } as never;
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('To Do · access token de Google reusado', () => {
  function armar() {
    const cuenta = { refreshTokenEnc: encriptarSecreto('rt', CLAVE) };
    const tx = {
      googleCuenta: { findUnique: vi.fn().mockResolvedValue(cuenta), deleteMany: vi.fn() },
    };
    const db = { withTenant: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const google = {
      refreshAccessToken: vi.fn().mockResolvedValue({ accessToken: 'at', expiraEnSeg: 3599 }),
      listEvents: vi.fn().mockResolvedValue({ eventos: [], truncado: false }),
    };
    const svc = new TodoService(db as never, google as never, config());
    return { svc, google };
  }

  // Se pedía un token nuevo en CADA cambio de vista: un viaje más a Google
  // antes de poder pedir los eventos.
  it('dos vistas distintas usan el mismo access token', async () => {
    const { svc, google } = armar();
    await svc.getEventos(CTX, { vista: 'dia', fecha: '2026-10-06' });
    await svc.getEventos(CTX, { vista: 'mes', fecha: '2026-10-06' });
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(google.listEvents).toHaveBeenCalledTimes(2);
  });

  it('pasados 55 minutos se renueva', async () => {
    vi.useFakeTimers();
    const { svc, google } = armar();
    await svc.getEventos(CTX, { vista: 'dia', fecha: '2026-10-06' });
    vi.advanceTimersByTime(55 * 60 * 1000 + 1);
    await svc.getEventos(CTX, { vista: 'mes', fecha: '2026-10-06' });
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  it('si Google rechaza el token cacheado, renueva una vez y reintenta', async () => {
    const { svc, google } = armar();
    await svc.getEventos(CTX, { vista: 'dia', fecha: '2026-10-06' });
    google.listEvents.mockRejectedValueOnce(new TokenDeGoogleRechazado());
    const r = await svc.getEventos(CTX, { vista: 'semana', fecha: '2026-10-06' });
    expect(r.eventos).toEqual([]);
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(2);
  });

  it('desconectar descarta el token', async () => {
    const { svc, google } = armar();
    await svc.getEventos(CTX, { vista: 'dia', fecha: '2026-10-06' });
    await svc.desconectar(CTX);
    await svc.getEventos(CTX, { vista: 'mes', fecha: '2026-10-06' });
    expect(google.refreshAccessToken).toHaveBeenCalledTimes(2);
  });
});

describe('To Do · paginación de Google', () => {
  function evento(i: number) {
    return { id: `e${i}`, summary: `Evento ${i}`, start: { dateTime: '2026-10-06T10:00:00Z' } };
  }

  // Se pedía una sola página de 250 y el resto se perdía en silencio.
  it('sigue nextPageToken y junta todas las páginas', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [evento(1)], nextPageToken: 'p2' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [evento(2)] })));
    const r = await new GoogleService(config()).listEvents('at', 'a', 'b');
    expect(r.eventos.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(r.truncado).toBe(false);
    expect(String(fetchSpy.mock.calls[1]![0])).toContain('pageToken=p2');
  });

  it('con más páginas que el techo, avisa que quedó incompleto', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ items: [evento(1)], nextPageToken: 'sigue' })),
    );
    const r = await new GoogleService(config()).listEvents('at', 'a', 'b');
    expect(r.truncado).toBe(true);
    expect(r.eventos).toHaveLength(MAX_PAGINAS);
  });

  it('un 401 se distingue del resto de los errores', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 401 }));
    await expect(new GoogleService(config()).listEvents('at', 'a', 'b')).rejects.toBeInstanceOf(
      TokenDeGoogleRechazado,
    );
  });

  it('el error de Google no llega al usuario, va al log', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"quota exceeded for project 12345"}', { status: 500 }),
    );
    const err = await new GoogleService(config()).listEvents('at', 'a', 'b').catch((e: Error) => e);
    expect((err as Error).message).not.toContain('12345');
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('12345'));
  });
});
