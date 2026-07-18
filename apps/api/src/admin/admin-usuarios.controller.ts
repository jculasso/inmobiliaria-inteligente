import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateUsuarioAdminSchema,
  ResetPasswordSchema,
  UpdateUsuarioAdminSchema,
  type CreateUsuarioAdmin,
  type ResetPassword,
  type UpdateUsuarioAdmin,
} from '@vacker/types';
import { Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminUsuariosService } from './admin-usuarios.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/tenants/:tenantId/usuarios')
export class AdminUsuariosController {
  constructor(private readonly usuarios: AdminUsuariosService) {}

  @Get()
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Lista los usuarios de una inmobiliaria' })
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.usuarios.list(tenantId);
  }

  @Post()
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Alta de usuario: crea cuenta de Supabase Auth + perfil de negocio' })
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(CreateUsuarioAdminSchema)) dto: CreateUsuarioAdmin,
  ) {
    return this.usuarios.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Edita nombre/estado/roles de un usuario' })
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUsuarioAdminSchema)) dto: UpdateUsuarioAdmin,
  ) {
    return this.usuarios.update(tenantId, id, dto);
  }

  @Post(':id/reset-password')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Restablece la contraseña de acceso de un usuario' })
  resetPassword(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPassword,
  ) {
    return this.usuarios.resetPassword(tenantId, id, dto);
  }

  @Post(':id/activar-acceso')
  @Roles('admin_plataforma')
  @ApiOperation({ summary: 'Crea la cuenta de Supabase Auth para un usuario que todavía no tiene login' })
  activarAcceso(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPassword,
  ) {
    return this.usuarios.activarAcceso(tenantId, id, dto);
  }
}
