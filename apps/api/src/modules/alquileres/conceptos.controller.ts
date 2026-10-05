import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AnularConceptoSchema,
  ConceptoSueltoInputSchema,
  GenerarPeriodoSchema,
  PeriodoSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type AnularConcepto,
  type ConceptoSuelto,
  type GenerarPeriodo,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ConceptosService } from './conceptos.service';

/** Conceptos: la generación del mes, los gastos sueltos y la anulación (reglas 9 a 14 y 19). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/conceptos')
@Modulo('alquileres')
export class ConceptosController {
  constructor(private readonly conceptos: ConceptosService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiQuery({ name: 'periodo', example: '2026-11' })
  @ApiOperation({ summary: 'Conceptos de un mes' })
  listar(@Query('periodo', new ZodValidationPipe(PeriodoSchema)) periodo: string) {
    return this.conceptos.listar(periodo);
  }

  @Post('generar')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Genera los alquileres, gastos y honorarios de un mes; correrlo de nuevo no duplica' })
  generar(@Body(new ZodValidationPipe(GenerarPeriodoSchema)) dto: GenerarPeriodo, @CurrentUser() user: AuthPrincipal) {
    return this.conceptos.generar(ctxDe(user), dto.periodo);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Carga un gasto suelto de un contrato: expensas, impuestos, servicios, reparaciones' })
  crearSuelto(@Body(new ZodValidationPipe(ConceptoSueltoInputSchema)) dto: ConceptoSuelto, @CurrentUser() user: AuthPrincipal) {
    return this.conceptos.crearSuelto(ctxDe(user), dto);
  }

  @Post(':id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula un concepto sin cobros ni pagos aplicados' })
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AnularConceptoSchema)) dto: AnularConcepto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.conceptos.anular(ctxDe(user), id, dto.motivo);
  }
}
