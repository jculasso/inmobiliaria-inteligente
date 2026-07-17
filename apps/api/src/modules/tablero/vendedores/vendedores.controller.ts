import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateVendedorSchema,
  ObjetivoInputSchema,
  UpdateVendedorSchema,
  type CreateVendedor,
  type ObjetivoInput,
  type UpdateVendedor,
} from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../tablero.util';
import { VendedoresService } from './vendedores.service';

@ApiTags('tablero')
@ApiBearerAuth()
@Controller('tablero/vendedores')
export class VendedoresController {
  constructor(private readonly vendedores: VendedoresService) {}

  @Get()
  @Roles('team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Lista de usuarios comerciales (roles y objetivos)' })
  list() {
    return this.vendedores.list();
  }

  @Post()
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Alta de un usuario comercial' })
  create(
    @Body(new ZodValidationPipe(CreateVendedorSchema)) dto: CreateVendedor,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.vendedores.create(dto, ctxDe(user));
  }

  @Patch(':id')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Edita un usuario comercial (datos, roles, líder)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateVendedorSchema)) dto: UpdateVendedor,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.vendedores.update(id, dto, ctxDe(user));
  }

  @Delete(':id')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Baja lógica (marca inactivo)' })
  desactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedores.desactivar(id);
  }

  @Put(':id/objetivo')
  @Roles('direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Crea/actualiza el objetivo anual del vendedor' })
  setObjetivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ObjetivoInputSchema)) dto: ObjetivoInput,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.vendedores.setObjetivo(id, dto, ctxDe(user));
  }
}
