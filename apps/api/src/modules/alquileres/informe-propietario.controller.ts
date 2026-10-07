import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  EnviarInformeSchema,
  InformePeriodoQuerySchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type EnviarInforme,
  type InformePeriodoQuery,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { Costoso } from '../../common/limite-solicitudes';
import { pdfResponse } from '../../common/pdf-response';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { EnviosService } from './envios.service';
import { InformePropietarioService } from './informe-propietario.service';
import { ReciboService } from './recibo.service';

const DESDE = {
  name: 'desde',
  required: true,
  example: '2026-09',
  description: 'Primer mes del período, AAAA-MM.',
};
const HASTA = {
  name: 'hasta',
  required: true,
  example: '2026-09',
  description: 'Último mes, AAAA-MM; un año como máximo.',
};

/**
 * El informe al propietario (spec alquileres-fase-1.md, reglas 83 a 97): lo
 * que cobró, lo que se le descontó, lo que se le liquidó y los reclamos de sus
 * propiedades en un período. Lo ve quien administra el módulo; el propietario
 * recibe el PDF por mail y no entra (regla 83).
 */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/informes/propietarios')
@Modulo('alquileres')
export class InformePropietarioController {
  constructor(
    private readonly informes: InformePropietarioService,
    private readonly pdfs: ReciboService,
    private readonly envios: EnviosService,
  ) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Todos los propietarios del período: cobrado, descuentos, liquidado, pendiente y reclamos (regla 96)',
  })
  @ApiQuery(DESDE)
  @ApiQuery(HASTA)
  propietarios(@Query(new ZodValidationPipe(InformePeriodoQuerySchema)) q: InformePeriodoQuery) {
    return this.informes.propietarios(q);
  }

  @Get(':personaId')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'El informe de un propietario en un período: resumen, propiedades, descuentos, reclamos y liquidaciones',
  })
  @ApiQuery(DESDE)
  @ApiQuery(HASTA)
  informe(
    @Param('personaId', ParseUUIDPipe) personaId: string,
    @Query(new ZodValidationPipe(InformePeriodoQuerySchema)) q: InformePeriodoQuery,
  ) {
    return this.informes.informe(personaId, q);
  }

  @Post(':personaId/pdf')
  @Costoso()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'El informe del propietario en PDF, con la marca de la inmobiliaria' })
  @ApiQuery(DESDE)
  @ApiQuery(HASTA)
  async pdf(
    @Param('personaId', ParseUUIDPipe) personaId: string,
    @Query(new ZodValidationPipe(InformePeriodoQuerySchema)) q: InformePeriodoQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const { buffer, nombreArchivo } = await this.pdfs.informePropietario(ctxDe(user), personaId, q);
    return pdfResponse(buffer, nombreArchivo);
  }

  @Post(':personaId/enviar')
  @Costoso(5)
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Manda el PDF del informe por mail (Resend), de a una persona; queda en su historial',
  })
  enviar(
    @Param('personaId', ParseUUIDPipe) personaId: string,
    @Body(new ZodValidationPipe(EnviarInformeSchema)) body: EnviarInforme,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.envios.informePropietario(
      ctxDe(user),
      personaId,
      { desde: body.desde, hasta: body.hasta },
      body.para,
    );
  }
}
