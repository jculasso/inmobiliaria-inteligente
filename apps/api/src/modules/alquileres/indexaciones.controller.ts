import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConfirmarIndexacionSchema,
  PrevisualizarDiferenciasQuerySchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type ConfirmarIndexacion,
  type PrevisualizarDiferenciasQuery,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { IndexacionesService } from './indexaciones.service';

/** La bandeja «a indexar»: el sistema propone, una persona confirma (reglas 5 a 7). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/indexaciones')
@Modulo('alquileres')
export class IndexacionesController {
  constructor(private readonly indexaciones: IndexacionesService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Tramos a indexar con su propuesta, y hasta dónde llegan los índices' })
  bandeja() {
    return this.indexaciones.bandeja();
  }

  @Get(':tramoId/diferencias')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Vista previa de la liquidación final: qué diferencias generaría confirmar el tramo en los meses cobrados como parcial (null si no hay)',
  })
  diferencias(
    @Param('tramoId', ParseUUIDPipe) tramoId: string,
    @Query(new ZodValidationPipe(PrevisualizarDiferenciasQuerySchema))
    q: PrevisualizarDiferenciasQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.indexaciones.previsualizar(ctxDe(user), tramoId, q);
  }

  @Post(':tramoId/confirmar')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Confirma la indexación de un tramo; el importe lo recalcula la API. Genera la liquidación final de los meses cobrados como parcial',
  })
  confirmar(
    @Param('tramoId', ParseUUIDPipe) tramoId: string,
    @Body(new ZodValidationPipe(ConfirmarIndexacionSchema)) dto: ConfirmarIndexacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.indexaciones.confirmar(ctxDe(user), tramoId, dto);
  }
}
