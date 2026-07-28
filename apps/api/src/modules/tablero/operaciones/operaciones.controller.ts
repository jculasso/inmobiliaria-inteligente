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

/**
 * Quién LEE y quién ESCRIBE son dos conjuntos distintos a propósito.
 *
 * Leer lo puede hacer todo el mundo dentro de su alcance: el vendedor necesita
 * sus operaciones para sus KPIs, su ranking y sus objetivos.
 *
 * Escribir es solo de dirección y del admin del tenant. La carga la centraliza
 * la inmobiliaria: hasta el 28/07/2026 el vendedor y el team leader también
 * cargaban —era intencional, no un descuido—, y se revirtió por decisión de
 * negocio para que los números del tablero tengan un único origen.
 */
const PUEDEN_LEER = ['vendedor', 'team_leader', 'direccion', 'admin_tenant'] as const;
const PUEDEN_ESCRIBIR = ['direccion', 'admin_tenant'] as const;

@ApiTags('tablero')
@ApiBearerAuth()
@Controller('tablero/operaciones')
export class OperacionesController {
  constructor(private readonly operaciones: OperacionesService) {}

  @Get()
  @Roles(...PUEDEN_LEER)
  @ApiOperation({ summary: 'Lista operaciones (scope por rol; filtros año/mes/tipo)' })
  list(
    @Query(new ZodValidationPipe(OperacionFiltroSchema)) filtro: OperacionFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.operaciones.list(filtro, ctxDe(user));
  }

  @Get(':id')
  @Roles(...PUEDEN_LEER)
  @ApiOperation({ summary: 'Detalle de una operación' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.operaciones.getOne(id, ctxDe(user));
  }

  @Post()
  @Roles(...PUEDEN_ESCRIBIR)
  @ApiOperation({ summary: 'Crea una venta (con puntas) o un alquiler' })
  create(
    @Body(new ZodValidationPipe(CreateOperacionSchema)) dto: CreateOperacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.operaciones.create(dto, ctxDe(user));
  }

  @Patch(':id')
  @Roles(...PUEDEN_ESCRIBIR)
  @ApiOperation({ summary: 'Edita una operación' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateOperacionSchema)) dto: UpdateOperacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.operaciones.update(id, dto, ctxDe(user));
  }

  @Delete(':id')
  @Roles(...PUEDEN_ESCRIBIR)
  @ApiOperation({ summary: 'Elimina una operación' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.operaciones.remove(id, ctxDe(user));
  }
}
