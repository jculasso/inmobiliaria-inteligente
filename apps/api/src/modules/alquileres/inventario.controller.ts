import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  InventarioInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type Inventario,
} from '@vacker/types';
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
  constructor(private readonly inventario: InventarioService) {}

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
}
