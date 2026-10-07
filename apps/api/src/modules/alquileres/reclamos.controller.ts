import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AvisoProveedorSchema,
  CambioReclamoSchema,
  ReclamoInputSchema,
  ReclamosQuerySchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  type AvisoProveedor,
  type CambioReclamo,
  type Reclamo,
} from '@vacker/types';
import type { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ReclamosService } from './reclamos.service';

/** Reclamos de inquilinos y propietarios (entrega 15). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/reclamos')
@Modulo('alquileres')
export class ReclamosController {
  constructor(private readonly reclamos: ReclamosService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Reclamos abiertos (o todos), de un contrato o de una persona' })
  listar(
    @Query(new ZodValidationPipe(ReclamosQuerySchema)) q: z.output<typeof ReclamosQuerySchema>,
  ) {
    return this.reclamos.listar(q);
  }

  @Get('usuarios')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Quiénes pueden seguir un reclamo: usuarios activos con un rol que entra al módulo',
  })
  usuarios() {
    return this.reclamos.usuarios();
  }

  @Get(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Un reclamo con su historial' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.reclamos.obtener(id);
  }

  @Post()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Abre un reclamo, con quién lo sigue y el proveedor',
    description: 'Quien lo sigue tiene que estar activo y entrar al módulo: si no, 400.',
  })
  crear(
    @Body(new ZodValidationPipe(ReclamoInputSchema)) dto: Reclamo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reclamos.crear(ctxDe(user), dto);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Cambia estado, prioridad, quién lo sigue o el proveedor, o agrega una nota',
  })
  cambiar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CambioReclamoSchema)) cambio: CambioReclamo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reclamos.cambiar(ctxDe(user), id, cambio);
  }

  @Post(':id/avisar-proveedor')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Le manda al proveedor del reclamo el mail que redactó el operador',
    description:
      'Sale solo al email del proveedor del reclamo (el pedido no trae destinatario), a nombre de la inmobiliaria y con las respuestas al operador. Sin proveedor o sin email: 400. Queda en el historial del reclamo.',
  })
  avisarProveedor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AvisoProveedorSchema)) aviso: AvisoProveedor,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reclamos.avisarProveedor(ctxDe(user), id, aviso);
  }
}
