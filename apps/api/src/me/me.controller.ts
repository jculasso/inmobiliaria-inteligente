import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PermitidoConClaveTemporal } from '../auth/decorators';
import type { AuthPrincipal } from '../auth/auth-principal';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  // La web lo lee para saber que tiene que mandar a /cambiar-clave.
  @PermitidoConClaveTemporal()
  @ApiOperation({ summary: 'Perfil del usuario autenticado (identidad + roles)' })
  me(@CurrentUser() principal: AuthPrincipal): AuthPrincipal {
    return principal;
  }
}
