import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { Rol } from '@vacker/types';
import { RolesGuard } from './roles.guard';
import type { AuthPrincipal } from './auth-principal';

function makeContext(principal?: AuthPrincipal): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(required: Rol[] | undefined): Reflector {
  return { getAllAndOverride: () => required } as unknown as Reflector;
}

function principal(roles: Rol[]): AuthPrincipal {
  return { userId: 'u', email: 'u@t.test', tenantId: 't', roles };
}

describe('RolesGuard', () => {
  it('permite si el endpoint no declara roles', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('permite si el principal tiene uno de los roles requeridos', () => {
    const guard = new RolesGuard(makeReflector(['admin_tenant', 'direccion']));
    expect(guard.canActivate(makeContext(principal(['direccion'])))).toBe(true);
  });

  it('rechaza si el principal no tiene ninguno de los roles requeridos', () => {
    const guard = new RolesGuard(makeReflector(['admin_tenant']));
    expect(() => guard.canActivate(makeContext(principal(['vendedor'])))).toThrow(ForbiddenException);
  });

  it('rechaza si no hay principal', () => {
    const guard = new RolesGuard(makeReflector(['vendedor']));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
