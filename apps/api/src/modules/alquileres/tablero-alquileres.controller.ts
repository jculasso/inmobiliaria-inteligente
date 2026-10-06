import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ROLES_ADMINISTRACION_ALQUILERES,
  TableroAlquileresQuerySchema,
  type TableroAlquileresQuery,
} from '@vacker/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
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
  @ApiOperation({
    summary: 'Cartera, cobranza del mes, morosidad, ingresos y lo que hay que hacer',
  })
  @ApiQuery({
    name: 'tipo',
    required: false,
    enum: ['todos', 'vivienda', 'comercial'],
    description: 'Todos, solo particulares o solo comerciales.',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    example: 2026,
    description: 'El año de la evolución y los ingresos mes a mes; por defecto, el actual.',
  })
  obtener(@Query(new ZodValidationPipe(TableroAlquileresQuerySchema)) q: TableroAlquileresQuery) {
    return this.tablero.tablero(undefined, q.anio, q.tipo);
  }

  @Get('completo')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Los tres cortes del tablero —todos, particulares y comerciales— de una sola lectura',
  })
  @ApiQuery({ name: 'anio', required: false, example: 2026 })
  completo(@Query(new ZodValidationPipe(TableroAlquileresQuerySchema)) q: TableroAlquileresQuery) {
    return this.tablero.tableros(undefined, q.anio);
  }
}
