import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CambioFirmaManualSchema, ROLES_ADMINISTRACION_ALQUILERES, type CambioFirmaManual } from '@vacker/types';
import { CurrentUser, Modulo, Public, Roles } from '../../../auth/decorators';
import type { AuthPrincipal } from '../../../auth/auth-principal';
import { uploadPdf } from '../../../common/upload';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe';
import { ctxDe } from '../../tablero/tablero.util';
import { FirmaAvisosService } from './firma-avisos.service';
import { FirmaService, type ArchivoPdf } from './firma.service';

const conArchivo = (f: ArchivoPdf | undefined): ArchivoPdf => {
  if (!f) throw new BadRequestException('Falta el archivo.');
  return f;
};

/** El documento del contrato y su firma (reglas 33 a 36). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres')
@Modulo('alquileres')
export class FirmaController {
  constructor(private readonly firma: FirmaService) {}

  @Get('contratos/:id/documento')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'El documento del contrato, sus firmantes y cada cambio de estado' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.firma.obtener(id);
  }

  @Post('contratos/:id/documento')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadPdf))
  @ApiOperation({ summary: 'Carga o cambia el PDF del contrato, mientras no se haya enviado a firmar' })
  cargar(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: ArchivoPdf | undefined, @CurrentUser() user: AuthPrincipal) {
    return this.firma.cargar(ctxDe(user), id, conArchivo(file));
  }

  @Post('documentos/:id/enviar')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Lo manda a firmar con el proveedor configurado (o lo marca como enviado, con el manual)' })
  enviar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.firma.enviar(ctxDe(user), id);
  }

  @Post('documentos/:id/firma')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Carga a mano quién firmó, o que venció' })
  cambiar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(CambioFirmaManualSchema)) dto: CambioFirmaManual, @CurrentUser() user: AuthPrincipal) {
    return this.firma.cambiar(ctxDe(user), id, dto);
  }

  @Post('documentos/:id/firmado')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadPdf))
  @ApiOperation({ summary: 'Sube el PDF firmado: firmaron todos' })
  cargarFirmado(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: ArchivoPdf | undefined, @CurrentUser() user: AuthPrincipal) {
    return this.firma.cargarFirmado(ctxDe(user), id, conArchivo(file));
  }

  @Get('documentos/:id/archivo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Link de vida corta al PDF, el original o el firmado' })
  archivo(@Param('id', ParseUUIDPipe) id: string, @Query('firmado') firmado?: string) {
    return this.firma.url(id, firmado === '1');
  }
}

/**
 * Los avisos de los proveedores de firma (regla 34). Sin sesión: los manda el
 * proveedor. La autenticidad la decide cada adaptador (firma o token del
 * aviso), y un envío que no existe se rechaza.
 */
@ApiExcludeController()
@Controller('webhooks/firma')
export class FirmaAvisosController {
  constructor(private readonly avisos: FirmaAvisosService) {}

  @Post(':proveedor')
  @Public()
  @HttpCode(200)
  recibir(@Param('proveedor') proveedor: string, @Headers() cabeceras: Record<string, string | string[] | undefined>, @Body() cuerpo: unknown) {
    return this.avisos.procesar(proveedor, cabeceras, cuerpo);
  }
}
