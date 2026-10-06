import { Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { SupabaseStorageService } from './supabase-storage.service';
import { SupabaseAdminService, mensajeParaUsuario } from '../admin/supabase-admin.service';

/**
 * Lo que responde un servicio de terceros (Supabase, Google) o la base al
 * fallar se registra en el servidor y NO viaja al navegador: puede nombrar
 * buckets, rutas, políticas, índices o columnas internas.
 */

const SECRETO_INTERNO = 'policy "storage_admin" on bucket tasador-fotos/t1/x.jpg';

function config() {
  return {
    getOrThrow: (k: string) => (k === 'SUPABASE_URL' ? 'https://x.supabase.co' : 'clave'),
  } as never;
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Storage · errores', () => {
  function fetchQueFalla(status = 500, body = SECRETO_INTERNO) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(body, { status }));
  }

  it('subir: el mensaje no incluye la respuesta de Storage', async () => {
    fetchQueFalla();
    const svc = new SupabaseStorageService(config());
    const err = await svc.upload('b', 'p', Buffer.from('x'), 'image/png').catch((e: Error) => e);
    expect((err as Error).message).not.toContain('policy');
    expect((err as Error).message).toMatch(/No se pudo subir/);
  });

  it('firmar: el mensaje no incluye la respuesta de Storage', async () => {
    fetchQueFalla();
    const svc = new SupabaseStorageService(config());
    const err = await svc.signedUrl('b', 'p').catch((e: Error) => e);
    expect((err as Error).message).not.toContain('policy');
    const err2 = await svc.signedUrls('b', ['p']).catch((e: Error) => e);
    expect((err2 as Error).message).not.toContain('policy');
  });

  it('borrar: el mensaje no incluye la respuesta de Storage', async () => {
    fetchQueFalla();
    const svc = new SupabaseStorageService(config());
    const err = await svc.remove('b', 'p').catch((e: Error) => e);
    expect((err as Error).message).not.toContain('policy');
  });

  it('lo que respondió Storage sí queda en el log del servidor', async () => {
    fetchQueFalla();
    const svc = new SupabaseStorageService(config());
    await svc.remove('b', 'p').catch(() => undefined);
    expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('policy'));
  });

  it('toda llamada a Storage lleva un tope de tiempo', async () => {
    const spy = fetchQueFalla(200, '{}');
    const svc = new SupabaseStorageService(config());
    await svc.remove('b', 'p');
    await svc.upload('b', 'p', Buffer.from('x'), 'image/png');
    for (const [, init] of spy.mock.calls) {
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('Supabase Auth · errores', () => {
  it('traduce el email repetido a un mensaje en castellano', () => {
    expect(mensajeParaUsuario({ error_code: 'email_exists', msg: 'A user...' }, 'x')).toBe(
      'Ya existe una cuenta con ese email.',
    );
    expect(
      mensajeParaUsuario(
        { msg: 'A user with this email address has already been registered' },
        'x',
      ),
    ).toBe('Ya existe una cuenta con ese email.');
  });

  it('cualquier otro texto de Supabase no llega al usuario', () => {
    const m = mensajeParaUsuario({ msg: `Database error: ${SECRETO_INTERNO}` }, 'crear el usuario');
    expect(m).not.toContain('policy');
    expect(m).toMatch(/No se pudo crear el usuario/);
  });

  it('setEmail responde con el mensaje traducido y lleva tope de tiempo', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ msg: SECRETO_INTERNO }), { status: 500 }) as Response,
      );
    const svc = new SupabaseAdminService(config());
    const err = await svc.setEmail('a', 'b@c.test').catch((e: Error) => e);
    expect((err as Error).message).not.toContain('policy');
    expect((spy.mock.calls[0]![1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });
});

describe('Filtro de excepciones · índice único', () => {
  it('un P2002 no expone el nombre del índice ni las columnas', () => {
    const json = vi.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status: () => ({ json }) }) }),
    } as unknown as ArgumentsHost;
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['tenant_id', 'codigo'] },
    });
    new AllExceptionsFilter().catch(err, host);
    const body = json.mock.calls[0]![0] as { error: { details?: unknown; message: string } };
    expect(body.error.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('tenant_id');
    expect(body.error.message).toMatch(/Ya existe/);
  });
});
