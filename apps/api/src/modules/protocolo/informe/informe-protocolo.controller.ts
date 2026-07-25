import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { pdfResponse } from '../../../common/pdf-response';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Modulo, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ctxDe } from '../../tablero/tablero.util';
import { InformeProtocoloService } from './informe-protocolo.service';

@ApiTags('protocolo')
@ApiBearerAuth()
@Controller('protocolo')
@Modulo('protocolo')
export class InformeProtocoloController {
  constructor(private readonly informes: InformeProtocoloService) {}

  @Post(':id/informe')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Genera el informe de comercialización y devuelve el PDF' })
  async generar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.informes.generar(id, ctxDe(user));
    return pdfResponse(buffer, nombreArchivo);
  }
}
