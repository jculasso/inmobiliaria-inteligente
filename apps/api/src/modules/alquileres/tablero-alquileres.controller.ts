import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES_ADMINISTRACION_ALQUILERES } from '@vacker/types';
import { Modulo, Roles } from '../../auth/decorators';
import { TableroAlquileresService } from './tablero-alquileres.service';

/** El tablero del módulo (reglas 26 a 32). Cada número viaja con lo que cuenta. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/tablero')
@Modulo('alquileres')
export class TableroAlquileresController {
  constructor(private readonly tablero: TableroAlquileresService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Cartera, cobranza del mes, morosidad, ingresos y lo que hay que hacer' })
  obtener() {
    return this.tablero.tablero();
  }
}
