import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { pdfResponse } from '../../../common/pdf-response';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ctxDe } from '../../tablero/tablero.util';
import { InformesService } from './informes.service';

@ApiTags('tasador')
@ApiBearerAuth()
@Controller('tasador/tasaciones')
export class InformesController {
  constructor(private readonly informes: InformesService) {}

  @Post(':id/informe')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Genera el informe de tasación y devuelve el PDF' })
  async generar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.informes.generar(id, ctxDe(user));
    return pdfResponse(buffer, nombreArchivo);
  }
}
