import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES_EXPORTACION } from '@vacker/types';
import { CurrentUser, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ctxDe } from '../tablero/tablero.util';
import { ExportacionService } from './exportacion.service';
import { zipResponse } from '../../common/zip-response';

@ApiTags('exportacion')
@ApiBearerAuth()
@Controller('exportacion')
export class ExportacionController {
  constructor(private readonly exportacion: ExportacionService) {}

  // POST y no GET: genera un archivo y queda registrado en el log. Además el
  // front lo baja con el token en la cabecera, igual que los PDF.
  //
  // NO lleva @Modulo(): los datos son de la inmobiliaria, no de un módulo
  // contratado. Poder llevárselos no puede depender de qué tenga contratado.
  @Post()
  @Roles(...ROLES_EXPORTACION)
  @ApiOperation({ summary: 'Descarga todos los datos de la inmobiliaria en planillas' })
  async exportar(@CurrentUser() user: AuthPrincipal) {
    const { buffer, nombreArchivo } = await this.exportacion.exportar(ctxDe(user));
    return zipResponse(buffer, nombreArchivo);
  }
}
