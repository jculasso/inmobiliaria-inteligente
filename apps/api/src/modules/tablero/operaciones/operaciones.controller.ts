import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateOperacionSchema,
  OperacionFiltroSchema,
  UpdateOperacionSchema,
  type CreateOperacion,
  type OperacionFiltro,
  type UpdateOperacion,
} from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../tablero.util';
import { OperacionesService } from './operaciones.service';

@ApiTags('tablero')
@ApiBearerAuth()
@Controller('tablero/operaciones')
export class OperacionesController {
  constructor(private readonly operaciones: OperacionesService) {}

  @Get()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Lista operaciones (scope por rol; filtros año/mes/tipo)' })
  list(
    @Query(new ZodValidationPipe(OperacionFiltroSchema)) filtro: OperacionFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.operaciones.list(filtro, ctxDe(user));
  }

  @Get(':id')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Detalle de una operación' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.operaciones.getOne(id, ctxDe(user));
  }

  @Post()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Crea una venta (con puntas) o un alquiler' })
  create(
    @Body(new ZodValidationPipe(CreateOperacionSchema)) dto: CreateOperacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.operaciones.create(dto, ctxDe(user));
  }

  @Patch(':id')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Edita una operación' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOperacionSchema)) dto: UpdateOperacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.operaciones.update(id, dto, ctxDe(user));
  }

  @Delete(':id')
  @Roles('team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Elimina una operación' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.operaciones.remove(id, ctxDe(user));
  }
}
