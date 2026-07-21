import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { ctxDe } from '../../tablero/tablero.util';
import { FotosService, type FotoFile } from './fotos.service';

@ApiTags('tasador')
@ApiBearerAuth()
@Controller('tasador/tasaciones/:id/fotos')
export class FotosController {
  constructor(private readonly fotos: FotosService) {}

  @Post()
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube una foto de la propiedad (máx. 3 por tasación, 5MB, imagen)' })
  @UseInterceptors(FileInterceptor('file'))
  subir(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: FotoFile | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo.');
    return this.fotos.subir(id, file, ctxDe(user));
  }

  @Delete(':fotoId')
  @Roles('vendedor', 'team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Elimina una foto de la propiedad' })
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.fotos.eliminar(id, fotoId, ctxDe(user));
  }
}
