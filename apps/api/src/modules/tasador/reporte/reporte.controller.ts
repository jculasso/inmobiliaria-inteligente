import { Controller, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasadorKpiFiltroSchema, type TasadorKpiFiltro } from '@vacker/types';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../../tablero/tablero.util';
import { ReporteService } from './reporte.service';

@ApiTags('tasador')
@ApiBearerAuth()
@Controller('tasador/reporte')
export class ReporteController {
  constructor(private readonly reporte: ReporteService) {}

  @Post('informe')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Genera el reporte de tasaciones del período en PDF y devuelve su URL' })
  generar(
    @Query(new ZodValidationPipe(TasadorKpiFiltroSchema)) filtro: TasadorKpiFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reporte.generar(filtro, ctxDe(user));
  }
}
