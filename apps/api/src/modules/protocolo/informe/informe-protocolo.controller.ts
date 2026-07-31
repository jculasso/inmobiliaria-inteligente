import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { pdfResponse } from '../../../common/pdf-response';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES_REPORTE_PROTOCOLO } from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ctxDe } from '../../tablero/tablero.util';
import { InformeProtocoloService } from './informe-protocolo.service';
import { ReporteSemanalPdfService } from './reporte-semanal-pdf.service';

@ApiTags('protocolo')
@ApiBearerAuth()
@Controller('protocolo')
@Modulo('protocolo')
export class InformeProtocoloController {
  constructor(
    private readonly informes: InformeProtocoloService,
    private readonly reporteSemanal: ReporteSemanalPdfService,
  ) {}

  // POST y no GET porque genera un documento; además el front abre la pestaña
  // dentro del click y le manda el token (ver abrir-pdf.ts).
  @Post('reporte-semanal/pdf')
  @Roles(...ROLES_REPORTE_PROTOCOLO)
  @ApiOperation({ summary: 'Reporte semanal en PDF, para imprimir o adjuntar' })
  async generarReporteSemanal(@CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.reporteSemanal.generar(ctxDe(user));
    return pdfResponse(buffer, nombreArchivo);
  }

  @Post(':id/informe')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Genera el informe de comercialización y devuelve el PDF' })
  async generar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.informes.generar(id, ctxDe(user));
    return pdfResponse(buffer, nombreArchivo);
  }
}
