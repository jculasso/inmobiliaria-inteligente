import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { ModuloKey, Rol } from '@vacker/types';
import type { AuthPrincipal } from './auth-principal';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca un endpoint como accesible sin autenticación (ej. /health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restringe un endpoint a uno o más roles (RBAC). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export const MODULO_KEY = 'modulo';
/**
 * Exige que el tenant tenga habilitado el módulo. Se declara a nivel de
 * controller: sin esto la API queda abierta aunque la Home oculte la tarjeta.
 */
export const Modulo = (modulo: ModuloKey) => SetMetadata(MODULO_KEY, modulo);

/** Inyecta el AuthPrincipal del request en un parámetro del handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal | undefined => {
    const req = ctx.switchToHttp().getRequest<{ principal?: AuthPrincipal }>();
    return req.principal;
  },
);
