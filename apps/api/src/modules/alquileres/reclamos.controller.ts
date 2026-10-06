import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CambioReclamoSchema,
  ReclamoInputSchema,
  ReclamosQuerySchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type CambioReclamo,
  type Reclamo,
} from '@vacker/types';
import type { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ReclamosService } from './reclamos.service';

/** Reclamos de inquilinos y propietarios (entrega 15). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/reclamos')
@Modulo('alquileres')
export class ReclamosController {
  constructor(private readonly reclamos: ReclamosService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Reclamos abiertos (o todos), de un contrato o de una persona' })
  listar(
    @Query(new ZodValidationPipe(ReclamosQuerySchema)) q: z.output<typeof ReclamosQuerySchema>,
  ) {
    return this.reclamos.listar(q);
  }

  @Get('usuarios')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'A quién se le puede asignar un reclamo' })
  usuarios() {
    return this.reclamos.usuarios();
  }

  @Get(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Un reclamo con su historial' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.reclamos.obtener(id);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Abre un reclamo' })
  crear(
    @Body(new ZodValidationPipe(ReclamoInputSchema)) dto: Reclamo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reclamos.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Cambia estado, prioridad o asignado, o agrega una nota' })
  cambiar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CambioReclamoSchema)) cambio: CambioReclamo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reclamos.cambiar(ctxDe(user), id, cambio);
  }
}
