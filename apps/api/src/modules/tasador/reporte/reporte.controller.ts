import { Controller, Post, Query } from '@nestjs/common';
import { pdfResponse } from '../../../common/pdf-response';
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
  @ApiOperation({ summary: 'Genera el reporte de tasaciones del período y devuelve el PDF' })
  async generar(
    @Query(new ZodValidationPipe(TasadorKpiFiltroSchema)) filtro: TasadorKpiFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const { buffer, nombreArchivo } = await this.reporte.generar(filtro, ctxDe(user));
    return pdfResponse(buffer, nombreArchivo);
  }
}
