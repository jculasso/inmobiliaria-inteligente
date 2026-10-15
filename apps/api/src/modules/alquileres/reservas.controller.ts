import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CambioEstadoReservaSchema,
  ContratoInputSchema,
  FiltroReservasSchema,
  GarantiasInputSchema,
  GenerarDesdePlantillaSchema,
  ReservaInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type CambioEstadoReserva,
  type Contrato,
  type Reserva,
} from '@vacker/types';
import type { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { docxResponse } from '../../common/docx-response';
import { Costoso } from '../../common/limite-solicitudes';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { PlantillasService, TIPO_DOCX } from './plantillas.service';
import { ReservasService } from './reservas.service';

/**
 * Las reservas: la etapa antes del contrato (reglas 154 a 168). No hay
 * DELETE: una reserva cambia de estado y su historia queda (regla 155).
 */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/reservas')
@Modulo('alquileres')
export class ReservasController {
  constructor(
    private readonly reservas: ReservasService,
    private readonly plantillas: PlantillasService,
  ) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiQuery({
    name: 'estado',
    required: false,
    description: '`abiertas` (por defecto), `todas` o un estado',
  })
  @ApiOperation({ summary: 'Reservas: las abiertas, todas o las de un estado (regla 164)' })
  listar(@Query('estado') estado?: string) {
    return this.reservas.listar(FiltroReservasSchema.parse(estado));
  }

  @Get('del-contrato/:contratoId')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'La reserva de la que salió un contrato, con su seña (regla 161); null si no salió de una',
  })
  delContrato(@Param('contratoId', ParseUUIDPipe) contratoId: string) {
    return this.reservas.delContrato(contratoId);
  }

  @Get(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Ficha de una reserva, con sus garantías y la línea de tiempo' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservas.obtener(id);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Registra una reserva; 409 si la propiedad ya tiene una abierta (regla 156)',
  })
  crear(
    @Body(new ZodValidationPipe(ReservaInputSchema)) dto: Reserva,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservas.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita los datos de una reserva abierta (regla 158)' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReservaInputSchema)) dto: Reserva,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservas.actualizar(ctxDe(user), id, dto);
  }

  @Post(':id/estado')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Un paso de la reserva: en estudio, aprobada, rechazada, vencida o anulada (regla 155); rechazar y anular piden motivo',
  })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CambioEstadoReservaSchema)) cambio: CambioEstadoReserva,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservas.cambiarEstado(ctxDe(user), id, cambio);
  }

  @Put(':id/garantias')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'El estudio de garantías de la reserva, con su informe (la lista completa, regla 157)',
  })
  guardarGarantias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(GarantiasInputSchema)) body: z.output<typeof GarantiasInputSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservas.guardarGarantias(ctxDe(user), id, body.garantias);
  }

  @Post(':id/convertir')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Crea el contrato (en borrador) desde una reserva aprobada: la reserva queda convertida y las garantías aprobadas pasan al contrato, todo junto (regla 159)',
  })
  convertir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ContratoInputSchema)) dto: Contrato,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservas.convertir(ctxDe(user), id, dto);
  }

  @Post(':id/generar-desde-plantilla')
  @HttpCode(200)
  @Costoso()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiProduces(TIPO_DOCX)
  @ApiOperation({
    summary:
      'La reserva en Word, completa con sus datos desde una plantilla de reserva (regla 163)',
  })
  async generar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(GenerarDesdePlantillaSchema))
    body: z.output<typeof GenerarDesdePlantillaSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const { buffer, nombre } = await this.plantillas.generarReserva(
      ctxDe(user),
      id,
      body.plantillaId,
    );
    return docxResponse(buffer, nombre);
  }
}
