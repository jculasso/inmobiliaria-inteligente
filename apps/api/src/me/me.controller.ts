import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { AuthPrincipal } from '../auth/auth-principal';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Perfil del usuario autenticado (identidad + roles)' })
  me(@CurrentUser() principal: AuthPrincipal): AuthPrincipal {
    return principal;
  }
}
