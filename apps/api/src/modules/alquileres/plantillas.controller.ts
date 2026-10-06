import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlantillaInputSchema, ROLES_ADMINISTRACION_ALQUILERES, VistaPreviaPlantillaSchema, type Plantilla } from '@vacker/types';
import type { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { pdfResponse } from '../../common/pdf-response';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { PlantillasService } from './plantillas.service';

/** Las plantillas de contrato de la inmobiliaria (entrega 15). */
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

  @Get('modelo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Un modelo de contrato para empezar' })
  modelo() {
    return this.plantillas.modeloBase();
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Crea una plantilla' })
  crear(@Body(new ZodValidationPipe(PlantillaInputSchema)) dto: Plantilla, @CurrentUser() user: AuthPrincipal) {
    return this.plantillas.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita una plantilla' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(PlantillaInputSchema)) dto: Plantilla) {
    return this.plantillas.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra una plantilla' })
  borrar(@Param('id', ParseUUIDPipe) id: string) {
    return this.plantillas.borrar(id);
  }

  @Post('vista-previa')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'El PDF de un texto con los datos de un contrato, para ver cómo queda' })
  async vistaPrevia(@Body(new ZodValidationPipe(VistaPreviaPlantillaSchema)) body: z.output<typeof VistaPreviaPlantillaSchema>, @CurrentUser() user: AuthPrincipal) {
    return pdfResponse(await this.plantillas.vistaPrevia(ctxDe(user), body.contratoId, body.cuerpo), 'Vista-previa');
  }
}
