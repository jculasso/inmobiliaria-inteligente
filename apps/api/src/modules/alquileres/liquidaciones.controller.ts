import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AnularLiquidacionSchema,
  LiquidacionInputSchema,
  PrepararLiquidacionSchema,
  EnviarPorMailSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type EnviarPorMail,
  type AnularLiquidacion,
  type Liquidacion,
  type PrepararLiquidacion,
} from '@vacker/types';
import { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { pdfResponse } from '../../common/pdf-response';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { LiquidacionesService } from './liquidaciones.service';
import { EnviosService } from './envios.service';
import { ReciboService } from './recibo.service';

const ListarSchema = z.object({ personaId: z.string().uuid().optional() });

/** Liquidaciones al propietario (reglas 20 a 23). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/liquidaciones')
@Modulo('alquileres')
export class LiquidacionesController {
  constructor(
    private readonly envios: EnviosService,
    private readonly liquidaciones: LiquidacionesService,
    private readonly pdfs: ReciboService,
  ) {}

  @Get('pendientes')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Propietarios con algo para liquidar hoy, y lo que les espera' })
  pendientes() {
    return this.liquidaciones.pendientes();
  }

  @Get('preparar')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Lo que entra en la liquidación de un propietario, y lo que espera' })
  preparar(@Query(new ZodValidationPipe(PrepararLiquidacionSchema)) q: PrepararLiquidacion) {
    return this.liquidaciones.preparar(q.personaId, q.moneda, q.fecha, q.excluidos);
  }

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Últimas liquidaciones, de todos o de una persona' })
  listar(@Query(new ZodValidationPipe(ListarSchema)) q: { personaId?: string }) {
    return this.liquidaciones.listar(q.personaId);
  }

  @Get(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Una liquidación con su detalle' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.liquidaciones.obtener(id);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Liquida a un propietario; lo que entra lo decide la API' })
  liquidar(
    @Body(new ZodValidationPipe(LiquidacionInputSchema)) dto: Liquidacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.liquidaciones.liquidar(ctxDe(user), dto);
  }

  @Post(':id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula una liquidación: sus conceptos vuelven a quedar por liquidar' })
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AnularLiquidacionSchema)) dto: AnularLiquidacion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.liquidaciones.anular(ctxDe(user), id, dto.motivo);
  }

  @Post(':id/pdf')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'La liquidación en PDF' })
  async pdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.pdfs.liquidacion(ctxDe(user), id);
    return pdfResponse(buffer, nombreArchivo);
  }

  @Post(':id/enviar')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Manda el PDF de la liquidación por mail (Resend); queda en el historial',
  })
  enviar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EnviarPorMailSchema)) body: EnviarPorMail,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.envios.liquidacion(ctxDe(user), id, body.para);
  }
}
