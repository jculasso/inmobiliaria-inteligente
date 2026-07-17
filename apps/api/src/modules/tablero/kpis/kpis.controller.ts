import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KpiFiltroSchema, type KpiFiltro } from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../tablero.util';
import { KpisService } from './kpis.service';

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
