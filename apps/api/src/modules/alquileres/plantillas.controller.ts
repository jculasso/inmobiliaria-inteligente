import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import {
  PlantillaMetadatosSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type PlantillaMetadatos,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { docxResponse } from '../../common/docx-response';
import { uploadUnArchivo } from '../../common/upload';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import type { ArchivoSubido } from './plantilla-word';
import { PlantillasService, TIPO_DOCX } from './plantillas.service';

const conArchivo = (f: ArchivoSubido | undefined): ArchivoSubido => {
  if (!f) throw new BadRequestException('Falta el archivo de Word.');
  return f;
};

/** Lo que documenta OpenAPI de una subida: el Word y, al crear, nombre y tipo. */
const cuerpoMultipart = (conMetadatos: boolean) => ({
  schema: {
    type: 'object',
    required: conMetadatos ? ['file', 'nombre'] : ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'El contrato en Word (.docx), hasta 5 MB',
      },
      ...(conMetadatos
        ? {
            nombre: { type: 'string', maxLength: 80 },
            tipoContrato: {
              type: 'string',
              enum: ['vivienda', 'comercial', ''],
              description: 'Vacío: sirve para los dos',
            },
          }
        : {}),
    },
  },
});

/**
 * Las plantillas de contrato de la inmobiliaria: Word con marcadores
 * (entrega 15, rehecha el 7/10/2026). El Word completo de un contrato se pide
 * en `POST /alquileres/contratos/:id/generar-desde-plantilla`.
 */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/plantillas')
@Modulo('alquileres')
export class PlantillasController {
  constructor(private readonly plantillas: PlantillasService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Plantillas de contrato de la inmobiliaria' })
  listar() {
    return this.plantillas.listar();
  }

  @Get('ejemplo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiProduces(TIPO_DOCX)
  @ApiOperation({
    summary:
      'Un Word de ejemplo con todos los marcadores explicados y un contrato armado con ellos',
  })
  ejemplo() {
    const { buffer, nombre } = this.plantillas.ejemplo();
    return docxResponse(buffer, nombre);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiConsumes('multipart/form-data')
  @ApiBody(cuerpoMultipart(true))
  @UseInterceptors(FileInterceptor('file', uploadUnArchivo))
  @ApiOperation({
    summary: 'Sube una plantilla en Word; rechaza los marcadores desconocidos o mal escritos',
  })
  crear(
    @Body(new ZodValidationPipe(PlantillaMetadatosSchema)) meta: PlantillaMetadatos,
    @UploadedFile() file: ArchivoSubido | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.plantillas.crear(ctxDe(user), meta, conArchivo(file));
  }

  @Put(':id/archivo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiConsumes('multipart/form-data')
  @ApiBody(cuerpoMultipart(false))
  @UseInterceptors(FileInterceptor('file', uploadUnArchivo))
  @ApiOperation({ summary: 'Reemplaza el Word de una plantilla, con la misma revisión' })
  reemplazarArchivo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: ArchivoSubido | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.plantillas.reemplazarArchivo(ctxDe(user), id, conArchivo(file));
  }

  @Get(':id/archivo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiProduces(TIPO_DOCX)
  @ApiOperation({ summary: 'El Word de la plantilla, tal como se subió' })
  async descargar(@Param('id', ParseUUIDPipe) id: string) {
    const { buffer, nombre } = await this.plantillas.descargar(id);
    return docxResponse(buffer, nombre);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Cambia el nombre de una plantilla o para qué contratos sirve' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PlantillaMetadatosSchema)) meta: PlantillaMetadatos,
  ) {
    return this.plantillas.actualizar(id, meta);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra una plantilla y su Word' })
  borrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.plantillas.borrar(id);
  }
}
