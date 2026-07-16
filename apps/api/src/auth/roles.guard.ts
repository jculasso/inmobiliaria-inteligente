import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '@vacker/types';
import type { AuthPrincipal } from './auth-principal';
import { ROLES_KEY } from './decorators';

/**
 * Guard global de RBAC. Corre después del AuthGuard. Si el endpoint declara
 * @Roles(), exige que el principal tenga al menos uno de esos roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ principal?: AuthPrincipal }>();
    const principal = req.principal;
    if (!principal) {
      throw new ForbiddenException('No autenticado.');
    }

    const allowed = principal.roles.some((r) => required.includes(r));
    if (!allowed) {
      throw new ForbiddenException('No tenés permisos para esta acción.');
    }
    return true;
  }
}
