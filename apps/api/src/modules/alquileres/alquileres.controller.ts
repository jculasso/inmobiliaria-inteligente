import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CandidatosQuerySchema, ROLES_ADMINISTRACION_ALQUILERES } from '@vacker/types';
import type { z } from 'zod';
import { Modulo, Roles } from '../../auth/decorators';
import { AlquileresService } from './alquileres.service';
import { CandidatosService } from './candidatos.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

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
  constructor(
    private readonly alquileres: AlquileresService,
    private readonly candidatos: CandidatosService,
  ) {}

  @Get('resumen')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Cuántos contratos, personas y propiedades tiene cargados la inmobiliaria' })
  resumen() {
    return this.alquileres.resumen();
  }

  @Get('candidatos')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Inquilinos (con lo que deben) o propietarios (con lo que hay para liquidarles), para elegir a quién se cobra o se liquida' })
  candidatosDe(@Query(new ZodValidationPipe(CandidatosQuerySchema)) q: z.infer<typeof CandidatosQuerySchema>) {
    return this.candidatos.listar(q.papel);
  }
}
