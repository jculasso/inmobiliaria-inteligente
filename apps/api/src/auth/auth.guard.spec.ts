import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { MODULOS_DEFAULT } from '@vacker/types';
import { MeController } from '../me/me.controller';
import { PasswordController } from '../me/password.controller';
import { TasacionesController } from '../modules/tasador/tasaciones/tasaciones.controller';
import { AdminTenantsController } from '../admin/admin-tenants.controller';
import { AuthGuard } from './auth.guard';
import { PrincipalCacheService } from './principal-cache.service';

interface UsuarioFila {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: null;
  tenantId: string;
  estado: string;
  debeCambiarPassword: boolean;
  roles: { rol: string }[];
  tenant: { nombre: string; plan: string; modulos: unknown; config: unknown; estado: string };
}

function fila(over: Partial<UsuarioFila> = {}, tenantEstado = 'activo'): UsuarioFila {
  return {
    id: 'u1',
    email: 'u1@t.test',
    nombre: 'Uno',
    fotoUrl: null,
    tenantId: 't1',
    estado: 'activo',
    debeCambiarPassword: false,
    roles: [{ rol: 'vendedor' }],
    tenant: {
      nombre: 'Test',
      plan: 'basico',
      modulos: MODULOS_DEFAULT,
      config: {},
      estado: tenantEstado,
    },
    ...over,
  };
}

function armar(usuario: UsuarioFila | null) {
  const findUnique = vi.fn().mockResolvedValue(usuario);
  const verifyToken = vi.fn().mockResolvedValue({ userId: 'auth-1' });
  const guard = new AuthGuard(
    new Reflector(),
    { verifyToken } as never,
    { usuario: { findUnique } } as never,
    { set: vi.fn() } as never,
    new PrincipalCacheService(),
  );
  return { guard, findUnique, verifyToken };
}

/** Un contexto apuntando a un handler REAL: así se lee la metadata de verdad. */
function ctx(clase: object, handler: (...args: never[]) => unknown): ExecutionContext {
  const req = { headers: { authorization: 'Bearer tok' } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => clase,
  } as unknown as ExecutionContext;
}

const ME = () => ctx(MeController, MeController.prototype.me);
const CAMBIAR_CLAVE = () => ctx(PasswordController, PasswordController.prototype.cambiar);
const TASACIONES = () => ctx(TasacionesController, TasacionesController.prototype.list);
const ADMIN = () => ctx(AdminTenantsController, AdminTenantsController.prototype.list);

describe('AuthGuard · inmobiliaria suspendida', () => {
  it('rechaza a un usuario de una inmobiliaria suspendida', async () => {
    const { guard } = armar(fila({}, 'suspendido'));
    await expect(guard.canActivate(TASACIONES())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza también /me: la sesión no sirve para nada mientras esté suspendida', async () => {
    const { guard } = armar(fila({}, 'suspendido'));
    await expect(guard.canActivate(ME())).rejects.toThrow(/suspendida/);
  });

  it('el admin de plataforma sigue entrando aunque su inmobiliaria esté suspendida', async () => {
    const { guard } = armar(fila({ roles: [{ rol: 'admin_plataforma' }] }, 'suspendido'));
    await expect(guard.canActivate(ADMIN())).resolves.toBe(true);
  });

  it('una inmobiliaria activa entra normal', async () => {
    const { guard } = armar(fila());
    await expect(guard.canActivate(TASACIONES())).resolves.toBe(true);
  });

  it('un usuario inactivo sigue siendo 401', async () => {
    const { guard } = armar(fila({ estado: 'inactivo' }));
    await expect(guard.canActivate(TASACIONES())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthGuard · contraseña temporal', () => {
  const conTemporal = () => fila({ debeCambiarPassword: true });

  it('deja leer el perfil', async () => {
    const { guard } = armar(conTemporal());
    await expect(guard.canActivate(ME())).resolves.toBe(true);
  });

  it('deja cambiar la contraseña', async () => {
    const { guard } = armar(conTemporal());
    await expect(guard.canActivate(CAMBIAR_CLAVE())).resolves.toBe(true);
  });

  it('rechaza cualquier otro endpoint con un mensaje que dice qué hacer', async () => {
    const { guard } = armar(conTemporal());
    const p = guard.canActivate(TASACIONES());
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(TASACIONES())).rejects.toThrow(/contraseña/);
  });

  it('sin contraseña temporal, todo pasa', async () => {
    const { guard } = armar(fila());
    await expect(guard.canActivate(TASACIONES())).resolves.toBe(true);
  });
});

describe('AuthGuard · cache del principal', () => {
  it('requests simultáneas con el mismo token resuelven UNA vez contra la base', async () => {
    const { guard, findUnique, verifyToken } = armar(fila());
    await Promise.all([
      guard.canActivate(TASACIONES()),
      guard.canActivate(TASACIONES()),
      guard.canActivate(ME()),
    ]);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(verifyToken).toHaveBeenCalledTimes(1);
  });

  it('un rechazo no queda cacheado', async () => {
    const { guard, findUnique } = armar(null);
    await expect(guard.canActivate(ME())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ME())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
