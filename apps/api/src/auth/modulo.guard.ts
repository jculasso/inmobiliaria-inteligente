import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ModuloKey } from '@vacker/types';
import type { AuthPrincipal } from './auth-principal';
import { MODULO_KEY } from './decorators';

/**
 * Guard global de licenciamiento. Corre después del AuthGuard. Si el endpoint
 * declara @Modulo(), exige que el tenant tenga ese módulo habilitado.
 *
 * Ocultar la tarjeta en la Home no alcanza: sin este guard, un usuario de un
 * tenant sin el módulo podría llamar la API igual.
 */
@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ModuloKey | undefined>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<{ principal?: AuthPrincipal }>();
    const principal = req.principal;
    if (!principal) {
      throw new ForbiddenException('No autenticado.');
    }

    if (!principal.tenant.modulos[required]) {
      throw new ForbiddenException('Tu inmobiliaria no tiene habilitado este módulo.');
    }
    return true;
  }
}
