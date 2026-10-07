import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  DetalleTableroQuerySchema,
  INDICADORES_DETALLE_TABLERO,
  ROLES_ADMINISTRACION_ALQUILERES,
  TRAMOS_MORA,
  TableroAlquileresQuerySchema,
  type DetalleTableroQuery,
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

  /**
   * Regla 79: la lista de un número del período, pedida al abrir la tarjeta.
   * El tablero trae los meses sumados; las listas de un año entero, por tres
   * cortes, harían doce veces más pesada la pantalla.
   */
  @Get('detalle')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'La lista de lo que cuenta un número del tablero en un período (suma ese número)',
  })
  @ApiQuery({ name: 'indicador', required: true, enum: INDICADORES_DETALLE_TABLERO })
  @ApiQuery({
    name: 'desde',
    required: true,
    example: '2026-07',
    description: 'Primer mes, AAAA-MM.',
  })
  @ApiQuery({
    name: 'hasta',
    required: true,
    example: '2026-09',
    description:
      'Último mes, AAAA-MM; un año como máximo. Las fotos (vigentes, alquiler mensual, deuda) son al cierre de este mes, o a hoy si no terminó.',
  })
  @ApiQuery({ name: 'tipo', required: false, enum: ['todos', 'vivienda', 'comercial'] })
  @ApiQuery({ name: 'moneda', required: false, enum: ['ARS', 'USD'] })
  @ApiQuery({ name: 'tramo', required: false, enum: TRAMOS_MORA, description: 'Solo con `mora`.' })
  detalle(@Query(new ZodValidationPipe(DetalleTableroQuerySchema)) q: DetalleTableroQuery) {
    return this.tablero.detalle(q);
  }
}
