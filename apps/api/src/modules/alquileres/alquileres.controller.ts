import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES_ADMINISTRACION_ALQUILERES } from '@vacker/types';
import { Modulo, Roles } from '../../auth/decorators';
import { AlquileresService } from './alquileres.service';

/**
 * Módulo Alquileres. Dos llaves independientes, y hacen falta las dos:
 *
 * - `@Modulo('alquileres')`: la inmobiliaria lo tiene contratado. Sin esto
 *   quedaría abierto para cualquier inmobiliaria aunque la Home no muestre la
 *   tarjeta.
 * - `@Roles(...ROLES_ADMINISTRACION_ALQUILERES)`: la MISMA lista que usa la
 *   web. `alquileres.roles.spec.ts` verifica que no se separen.
 */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres')
@Modulo('alquileres')
export class AlquileresController {
  constructor(private readonly alquileres: AlquileresService) {}

  @Get('resumen')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Cuántos contratos, personas y propiedades tiene cargados la inmobiliaria' })
  resumen() {
    return this.alquileres.resumen();
  }
}
