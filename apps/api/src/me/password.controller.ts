import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CambiarPasswordSchema, type CambiarPassword } from '@vacker/types';
import { CurrentUser } from '../auth/decorators';
import type { AuthPrincipal } from '../auth/auth-principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PasswordService } from './password.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class PasswordController {
  constructor(private readonly password: PasswordService) {}

  @Post('password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambia la contraseña del usuario autenticado' })
  cambiar(
    @Body(new ZodValidationPipe(CambiarPasswordSchema)) dto: CambiarPassword,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.password.cambiar(dto, user);
  }
}
