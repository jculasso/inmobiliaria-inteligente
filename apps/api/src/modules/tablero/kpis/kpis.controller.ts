import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { KpiFiltroSchema, type KpiFiltro } from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../tablero.util';
import { KpisService } from './kpis.service';

const AnioFiltroSchema = z.object({ anio: z.coerce.number().int().min(2000).max(2100) });
type AnioFiltro = z.infer<typeof AnioFiltroSchema>;

const RangoFiltroSchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mesInicio: z.coerce.number().int().min(1).max(12),
  mesFin: z.coerce.number().int().min(1).max(12),
});
type RangoFiltro = z.infer<typeof RangoFiltroSchema>;

@ApiTags('tablero')
@ApiBearerAuth()
@Controller('tablero/kpis')
export class KpisController {
  constructor(private readonly kpis: KpisService) {}

  @Get('resumen')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'KPIs de cabecera (volumen, puntas, comisión, pendiente, alquileres)' })
  resumen(
    @Query(new ZodValidationPipe(KpiFiltroSchema)) filtro: KpiFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.kpis.resumen(filtro, ctxDe(user));
  }

  @Get('ranking')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Ranking de vendedores por volumen' })
  ranking(
    @Query(new ZodValidationPipe(KpiFiltroSchema)) filtro: KpiFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.kpis.ranking(filtro, ctxDe(user));
  }

  @Get('mensual')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Agregados de los 12 meses del año (una sola consulta)' })
  mensual(
    @Query(new ZodValidationPipe(AnioFiltroSchema)) filtro: AnioFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.kpis.mensual(filtro.anio, ctxDe(user));
  }

  @Get('rango')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Agregado + ranking de un rango de meses en una sola consulta' })
  rango(
    @Query(new ZodValidationPipe(RangoFiltroSchema)) filtro: RangoFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.kpis.resumenRango(filtro.anio, filtro.mesInicio, filtro.mesFin, ctxDe(user));
  }

  @Get('objetivos')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Seguimiento real vs objetivo por vendedor' })
  objetivos(
    @Query(new ZodValidationPipe(KpiFiltroSchema)) filtro: KpiFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.kpis.objetivos(filtro, ctxDe(user));
  }
}
