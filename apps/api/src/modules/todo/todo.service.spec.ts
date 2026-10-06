import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '../../prisma/tenant-context';
import { TodoService, type Navegacion } from './todo.service';
import { TodoController, leerCookie } from './todo.controller';

const CLAVE = Buffer.alloc(32, 7).toString('base64');
const CTX: TenantContext = { tenantId: 't1', userId: 'u1', roles: ['vendedor'] };
const UA = 'Mozilla/5.0 (iPhone) Safari';
/** Así llega la navegación desde app.… hacia api.…: mismo sitio. */
const DESDE_LA_APP: Navegacion = {
  secFetchSite: 'same-site',
  referer: 'https://app.inmobiliariainteligente.net/',
  userAgent: UA,
};

function armar(usuarioHabilitado: unknown = { id: 'u1' }) {
  const tx = {
    usuario: { findFirst: vi.fn().mockResolvedValue(usuarioHabilitado) },
    googleCuenta: { upsert: vi.fn() },
  };
  const db = { withTenant: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  const google = {
    assertConfigurado: vi.fn(),
    redirectUri: () => 'https://api.inmobiliariainteligente.net/todo/google/callback',
    buildAuthUrl: vi.fn(
      (state: string) =>
        `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`,
    ),
    exchangeCode: vi.fn().mockResolvedValue({ refreshToken: 'rt', accessToken: 'at' }),
    getPrimaryEmail: vi.fn().mockResolvedValue('alguien@gmail.com'),
  };
  const config = {
    get: (k: string) =>
      ({
        GOOGLE_TOKEN_ENC_KEY: CLAVE,
        WEB_APP_URL: 'https://app.inmobiliariainteligente.net',
      })[k],
  };
  const svc = new TodoService(db as never, google as never, config as never);
  return { svc, tx, google };
}

function ticketDe(url: string): string {
  return new URL(url).searchParams.get('t')!;
}

function stateDe(url: string): string {
  return new URL(url).searchParams.get('state')!;
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('To Do · conexión con Google ligada al navegador (auditoría del 6/10/2026)', () => {
  it('connect NO devuelve la URL de Google sino un paso propio con ticket', () => {
    const { svc } = armar();
    const { url } = svc.connect(CTX, UA);
    expect(url.startsWith('https://api.inmobiliariainteligente.net/todo/google/iniciar?t=')).toBe(
      true,
    );
    expect(url).not.toContain('accounts.google.com');
  });

  it('iniciar desde la app devuelve la URL de Google y el número de la cookie', () => {
    const { svc } = armar();
    const r = svc.iniciar(ticketDe(svc.connect(CTX, UA).url), DESDE_LA_APP);
    expect(r.url).toContain('accounts.google.com');
    expect(r.nonce.length).toBeGreaterThan(30);
  });

  it('el ticket sirve una sola vez', () => {
    const { svc } = armar();
    const t = ticketDe(svc.connect(CTX, UA).url);
    svc.iniciar(t, DESDE_LA_APP);
    expect(() => svc.iniciar(t, DESDE_LA_APP)).toThrow(BadRequestException);
  });

  it('el ticket vence a los dos minutos', () => {
    vi.useFakeTimers();
    const { svc } = armar();
    const t = ticketDe(svc.connect(CTX, UA).url);
    vi.advanceTimersByTime(2 * 60 * 1000 + 1);
    expect(() => svc.iniciar(t, DESDE_LA_APP)).toThrow(BadRequestException);
  });

  // El ataque: el enlace se reenvía por mail o por chat. Esa navegación no sale
  // de nuestra web, y el navegador lo dice.
  it('un enlace abierto desde fuera de la app se rechaza', () => {
    const { svc } = armar();
    const desdeUnMail: Navegacion = { secFetchSite: 'none', userAgent: UA };
    const desdeOtroSitio: Navegacion = {
      secFetchSite: 'cross-site',
      referer: 'https://mail.google.com/',
      userAgent: UA,
    };
    expect(() => svc.iniciar(ticketDe(svc.connect(CTX, UA).url), desdeUnMail)).toThrow(
      ForbiddenException,
    );
    expect(() => svc.iniciar(ticketDe(svc.connect(CTX, UA).url), desdeOtroSitio)).toThrow(
      ForbiddenException,
    );
  });

  it('desde otro navegador (otro User-Agent) se rechaza', () => {
    const { svc } = armar();
    const t = ticketDe(svc.connect(CTX, UA).url);
    expect(() => svc.iniciar(t, { ...DESDE_LA_APP, userAgent: 'Otro navegador' })).toThrow(
      ForbiddenException,
    );
  });

  it('un `state` no sirve como ticket', () => {
    const { svc } = armar();
    const { url } = svc.iniciar(ticketDe(svc.connect(CTX, UA).url), DESDE_LA_APP);
    expect(() => svc.iniciar(stateDe(url), DESDE_LA_APP)).toThrow(BadRequestException);
  });

  it('el callback sin la cookie del navegador que inició NO vincula nada', async () => {
    const { svc, google, tx } = armar();
    const { url } = svc.iniciar(ticketDe(svc.connect(CTX, UA).url), DESDE_LA_APP);
    await expect(svc.handleCallback('code', stateDe(url), undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.handleCallback('code', stateDe(url), 'otro-numero')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(google.exchangeCode).not.toHaveBeenCalled();
    expect(tx.googleCuenta.upsert).not.toHaveBeenCalled();
  });

  it('el callback con la cookie correcta vincula la cuenta del usuario que inició', async () => {
    const { svc, tx } = armar();
    const { url, nonce } = svc.iniciar(ticketDe(svc.connect(CTX, UA).url), DESDE_LA_APP);
    const destino = await svc.handleCallback('code', stateDe(url), nonce);
    expect(destino).toBe('https://app.inmobiliariainteligente.net/todo?google=conectado');
    expect(tx.googleCuenta.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 'u1' } }),
    );
  });

  it('si el usuario ya no está habilitado, no se vincula', async () => {
    const { svc, google } = armar(null);
    const { url, nonce } = svc.iniciar(ticketDe(svc.connect(CTX, UA).url), DESDE_LA_APP);
    await expect(svc.handleCallback('code', stateDe(url), nonce)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(google.exchangeCode).not.toHaveBeenCalled();
  });
});

describe('To Do · el callback siempre vuelve a la web', () => {
  function res() {
    return {
      redirect: vi.fn(),
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };
  }
  const req = (headers: Record<string, string> = {}) => ({ headers, secure: true }) as never;

  // La PWA instalada no tiene barra de direcciones: un JSON de error en el
  // callback dejaba a la persona encerrada.
  it('cualquier falla termina en /todo?google=error, nunca en un JSON', async () => {
    const { svc } = armar();
    const ctrl = new TodoController(svc);
    const r = res();
    await ctrl.callback('code', 'basura', undefined, req(), r as never);
    expect(r.redirect).toHaveBeenCalledWith(
      302,
      'https://app.inmobiliariainteligente.net/todo?google=error',
    );
  });

  it('iniciar con un ticket inválido también vuelve a la web', () => {
    const { svc } = armar();
    const ctrl = new TodoController(svc);
    const r = res();
    ctrl.iniciar('basura', req({ 'sec-fetch-site': 'same-site' }), r as never);
    expect(r.redirect).toHaveBeenCalledWith(
      302,
      'https://app.inmobiliariainteligente.net/todo?google=error',
    );
    expect(r.cookie).not.toHaveBeenCalled();
  });

  it('iniciar deja una cookie httpOnly, SameSite=Lax y Secure, acotada al flujo', () => {
    const { svc } = armar();
    const ctrl = new TodoController(svc);
    const r = res();
    const t = ticketDe(svc.connect(CTX, UA).url);
    ctrl.iniciar(t, req({ 'sec-fetch-site': 'same-site', 'user-agent': UA }), r as never);
    expect(r.cookie).toHaveBeenCalledWith(
      'todo_google_nonce',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/todo/google',
      }),
    );
    expect(r.redirect.mock.calls[0]![1]).toContain('accounts.google.com');
  });

  it('el flujo completo por el controller vincula la cuenta', async () => {
    const { svc, tx } = armar();
    const ctrl = new TodoController(svc);
    const r1 = res();
    ctrl.iniciar(
      ticketDe(svc.connect(CTX, UA).url),
      req({ 'sec-fetch-site': 'same-site', 'user-agent': UA }),
      r1 as never,
    );
    const nonce = r1.cookie.mock.calls[0]![1] as string;
    const state = stateDe(r1.redirect.mock.calls[0]![1] as string);
    const r2 = res();
    await ctrl.callback(
      'code',
      state,
      undefined,
      req({ cookie: `otra=1; todo_google_nonce=${nonce}` }),
      r2 as never,
    );
    expect(r2.redirect).toHaveBeenCalledWith(
      302,
      'https://app.inmobiliariainteligente.net/todo?google=conectado',
    );
    expect(r2.clearCookie).toHaveBeenCalled();
    expect(tx.googleCuenta.upsert).toHaveBeenCalled();
  });
});

describe('leerCookie', () => {
  it('encuentra la cookie entre otras', () => {
    expect(leerCookie('a=1; todo_google_nonce=xyz; b=2', 'todo_google_nonce')).toBe('xyz');
    expect(leerCookie('a=1', 'todo_google_nonce')).toBeUndefined();
    expect(leerCookie(undefined, 'todo_google_nonce')).toBeUndefined();
  });
});
