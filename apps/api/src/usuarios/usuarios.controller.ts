import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { UsuariosService } from './usuarios.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @Roles('admin_tenant', 'direccion')
  @ApiOperation({ summary: 'Lista de usuarios del tenant' })
  list() {
    return this.usuarios.list();
  }
}
