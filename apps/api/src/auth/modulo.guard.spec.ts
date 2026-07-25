import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { MODULOS_DEFAULT, type ModuloKey, type ModulosTenant } from '@vacker/types';
import { ModuloGuard } from './modulo.guard';
import type { AuthPrincipal } from './auth-principal';

function makeContext(principal?: AuthPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(required: ModuloKey | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

function principal(modulos: Partial<ModulosTenant>): AuthPrincipal {
  return {
    userId: 'u',
    email: 'u@t.test',
    nombre: 'Usuario Test',
    fotoUrl: null,
    tenantId: 't',
    debeCambiarPassword: false,
    roles: ['vendedor'],
    tenant: {
      nombre: 'Test',
      plan: 'basico',
      modulos: { ...MODULOS_DEFAULT, ...modulos },
      config: {},
    },
  };
}

describe('ModuloGuard', () => {
  it('permite si el endpoint no declara módulo', () => {
    const guard = new ModuloGuard(makeReflector(undefined));
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('permite si el tenant tiene el módulo habilitado', () => {
    const guard = new ModuloGuard(makeReflector('protocolo'));
    expect(guard.canActivate(makeContext(principal({ protocolo: true })))).toBe(true);
  });

  it('rechaza si el tenant no tiene el módulo habilitado', () => {
    const guard = new ModuloGuard(makeReflector('protocolo'));
    expect(() => guard.canActivate(makeContext(principal({ protocolo: false })))).toThrow(
      ForbiddenException,
    );
  });

  it('rechaza si no hay principal', () => {
    const guard = new ModuloGuard(makeReflector('tablero'));
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });

  it('el plan no habilita módulos por sí solo (solo mandan los checks)', () => {
    const guard = new ModuloGuard(makeReflector('tasador'));
    const conPlanAlto = principal({ tasador: false });
    conPlanAlto.tenant.plan = 'enterprise';
    expect(() => guard.canActivate(makeContext(conPlanAlto))).toThrow(ForbiddenException);
  });
});
