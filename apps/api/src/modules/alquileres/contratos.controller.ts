import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CambiarEstadoContratoSchema,
  ContratoInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type CambiarEstadoContrato,
  type Contrato,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ContratosService } from './contratos.service';

/** Contratos de alquiler: alta, edición en borrador, ficha y cambios de estado. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/contratos')
@Modulo('alquileres')
export class ContratosController {
  constructor(private readonly contratos: ContratosService) {}

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
}
