import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AnularCobroSchema,
  CobroInputSchema,
  PrepararCobroSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type AnularCobro,
  type Cobro,
  type PrepararCobro,
} from '@vacker/types';
import { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { pdfResponse } from '../../common/pdf-response';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { CobrosService } from './cobros.service';
import { ReciboService } from './recibo.service';

const ListarCobrosSchema = z.object({ personaId: z.string().uuid().optional() });

/** Cobros: preparar, registrar, recibo, anular; y la cuenta corriente de cada persona (reglas 15 a 19, 23 y 24). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres')
@Modulo('alquileres')
export class CobrosController {
  constructor(
    private readonly cobros: CobrosService,
    private readonly recibos: ReciboService,
  ) {}

  @Get('cobros/preparar')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Lo que debe una persona a una fecha, con punitorios propuestos y saldo a favor' })
  preparar(@Query(new ZodValidationPipe(PrepararCobroSchema)) q: PrepararCobro) {
    return this.cobros.preparar(q.personaId, q.moneda, q.fecha);
  }

  @Get('cobros')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Últimos cobros, de todos o de una persona' })
  listar(@Query(new ZodValidationPipe(ListarCobrosSchema)) q: { personaId?: string }) {
    return this.cobros.listar(q.personaId);
  }

  @Get('cobros/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Un cobro con lo que canceló' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.cobros.obtener(id);
  }

  @Post('cobros')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Registra un cobro; la imputación la calcula la API' })
  registrar(@Body(new ZodValidationPipe(CobroInputSchema)) dto: Cobro, @CurrentUser() user: AuthPrincipal) {
    return this.cobros.registrar(ctxDe(user), dto);
  }

  @Post('cobros/:id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula un cobro: revierte lo que canceló y los punitorios que creó' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AnularCobroSchema)) dto: AnularCobro, @CurrentUser() user: AuthPrincipal) {
    return this.cobros.anular(ctxDe(user), id, dto.motivo);
  }

  // POST y no GET porque genera un documento; el front abre la pestaña dentro
  // del click y le manda el token (ver abrir-pdf.ts).
  @Post('cobros/:id/recibo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Recibo del cobro en PDF' })
  async recibo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.recibos.generar(ctxDe(user), id);
    return pdfResponse(buffer, nombreArchivo);
  }

  @Get('personas/:id/cuenta')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Cuenta corriente por moneda y estado de cuenta de una persona' })
  cuenta(@Param('id', ParseUUIDPipe) id: string) {
    return this.cobros.cuenta(id);
  }
}
