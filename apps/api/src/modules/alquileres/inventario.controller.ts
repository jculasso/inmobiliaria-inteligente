import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  GenerarAnexoSchema,
  InventarioInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type GenerarAnexo,
  type Inventario,
} from '@vacker/types';
import { docxResponse } from '../../common/docx-response';
import { Costoso } from '../../common/limite-solicitudes';
import { PlantillasService, TIPO_DOCX } from './plantillas.service';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { InventarioService } from './inventario.service';

/** El inventario del contrato (reglas 150 a 153): se lee y se guarda entero. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/contratos')
@Modulo('alquileres')
export class InventarioController {
  constructor(
    private readonly inventario: InventarioService,
    private readonly plantillas: PlantillasService,
  ) {}

  @Get(':id/inventario')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'El inventario del contrato: ítems y observaciones' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventario.obtener(id);
  }

  @Put(':id/inventario')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Guarda el inventario entero (la lista reemplaza a la anterior); en borrador y en vigente',
  })
  guardar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(InventarioInputSchema)) body: Inventario,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.inventario.guardar(ctxDe(user), id, body);
  }

  @Post(':id/anexo-inventario')
  @HttpCode(200)
  @Costoso()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiProduces(TIPO_DOCX)
  @ApiOperation({
    summary:
      'El anexo de inventario en Word (regla 174): con una plantilla de anexo, o sin `plantillaId`, con el modelo de la plataforma',
  })
  async anexo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(GenerarAnexoSchema)) body: GenerarAnexo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const { buffer, nombre } = await this.plantillas.generarAnexo(
      ctxDe(user),
      id,
      body.plantillaId,
    );
    return docxResponse(buffer, nombre);
  }
}
