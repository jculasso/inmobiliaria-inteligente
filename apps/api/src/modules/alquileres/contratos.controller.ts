import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AnularConMotivoSchema,
  CambiarEstadoContratoSchema,
  ContratoDatosSchema,
  ContratoInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type AnularConMotivo,
  type CambiarEstadoContrato,
  type Contrato,
  type ContratoDatos,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ContratosService } from './contratos.service';
import { HistorialService } from './historial';

/** Contratos de alquiler: alta, edición en borrador, ficha y cambios de estado. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/contratos')
@Modulo('alquileres')
export class ContratosController {
  constructor(
    private readonly contratos: ContratosService,
    private readonly historial: HistorialService,
  ) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Contratos, con el importe de hoy y la próxima indexación' })
  listar() {
    return this.contratos.listar();
  }

  @Get(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Ficha de un contrato' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.contratos.obtener(id);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Da de alta un contrato, en borrador' })
  crear(@Body(new ZodValidationPipe(ContratoInputSchema)) dto: Contrato, @CurrentUser() user: AuthPrincipal) {
    return this.contratos.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita un contrato en borrador' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ContratoInputSchema)) dto: Contrato,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.contratos.actualizar(ctxDe(user), id, dto);
  }

  @Post(':id/estado')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Activa, finaliza o rescinde un contrato' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CambiarEstadoContratoSchema)) cambio: CambiarEstadoContrato,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.contratos.cambiarEstado(ctxDe(user), id, cambio);
  }

  @Patch(':id/datos')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita lo que no toca plata de un contrato vigente' })
  actualizarDatos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ContratoDatosSchema)) datos: ContratoDatos,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.contratos.actualizarDatos(ctxDe(user), id, datos);
  }

  @Post(':id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula un contrato cargado por error, con motivo; anula también sus conceptos' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AnularConMotivoSchema)) body: AnularConMotivo, @CurrentUser() user: AuthPrincipal) {
    return this.contratos.anular(ctxDe(user), id, body.motivo);
  }

  @Delete(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra un contrato en borrador' })
  borrar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.contratos.borrar(ctxDe(user), id);
  }

  @Get(':id/historial')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Quién hizo qué y cuándo con este contrato, sus cobros y liquidaciones' })
  historialDe(@Param('id', ParseUUIDPipe) id: string) {
    return this.historial.delContrato(id);
  }
}
