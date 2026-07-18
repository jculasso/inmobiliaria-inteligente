import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateTasacionSchema,
  TasacionFiltroSchema,
  UpdateTasacionSchema,
  type CreateTasacion,
  type TasacionFiltro,
  type UpdateTasacion,
} from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../../tablero/tablero.util';
import { TasacionesService } from './tasaciones.service';

@ApiTags('tasador')
@ApiBearerAuth()
@Controller('tasador/tasaciones')
export class TasacionesController {
  constructor(private readonly tasaciones: TasacionesService) {}

  @Get()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Lista tasaciones (scope por rol; filtros año/mes/estado/agente)' })
  list(
    @Query(new ZodValidationPipe(TasacionFiltroSchema)) filtro: TasacionFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tasaciones.list(filtro, ctxDe(user));
  }

  @Get(':id')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Detalle de una tasación' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.tasaciones.getOne(id, ctxDe(user));
  }

  @Post()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Crea una tasación (dueño = usuario actual)' })
  create(
    @Body(new ZodValidationPipe(CreateTasacionSchema)) dto: CreateTasacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tasaciones.create(dto, ctxDe(user));
  }

  @Patch(':id')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Edita una tasación (datos del informe y características)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTasacionSchema)) dto: UpdateTasacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tasaciones.update(id, dto, ctxDe(user));
  }

  @Delete(':id')
  @Roles('team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Elimina una tasación' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.tasaciones.remove(id, ctxDe(user));
  }
}
