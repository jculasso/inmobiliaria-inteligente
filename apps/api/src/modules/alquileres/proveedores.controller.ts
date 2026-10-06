import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AnularConMotivoSchema,
  ComprobanteInputSchema,
  ComprobantesQuerySchema,
  PagarComprobanteSchema,
  ProveedorInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  TableroAlquileresQuerySchema,
  type Comprobante,
  type ProveedorAlquiler,
} from '@vacker/types';
import type { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ProveedoresService } from './proveedores.service';

/** Proveedores y sus comprobantes (entrega 18). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres')
@Modulo('alquileres')
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get('proveedores')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Proveedores, con lo que se les debe' })
  listar() {
    return this.proveedores.listar();
  }

  @Post('proveedores')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Da de alta un proveedor' })
  crear(@Body(new ZodValidationPipe(ProveedorInputSchema)) dto: ProveedorAlquiler, @CurrentUser() user: AuthPrincipal) {
    return this.proveedores.crear(ctxDe(user), dto);
  }

  @Patch('proveedores/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita un proveedor' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(ProveedorInputSchema)) dto: ProveedorAlquiler, @CurrentUser() user: AuthPrincipal) {
    return this.proveedores.actualizar(ctxDe(user), id, dto);
  }

  @Delete('proveedores/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra un proveedor sin comprobantes' })
  borrar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.proveedores.borrar(ctxDe(user), id);
  }

  @Get('comprobantes')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Comprobantes de proveedores (pendientes de pago o todos)' })
  comprobantes(@Query(new ZodValidationPipe(ComprobantesQuerySchema)) q: z.output<typeof ComprobantesQuerySchema>) {
    return this.proveedores.comprobantes(q);
  }

  @Get('comprobantes/reporte')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Gastos del año por rubro, por quién los paga y por mes' })
  reporte(@Query(new ZodValidationPipe(TableroAlquileresQuerySchema)) q: z.output<typeof TableroAlquileresQuerySchema>) {
    return this.proveedores.reporte(q.anio ?? new Date().getFullYear());
  }

  @Post('comprobantes')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Carga un comprobante; lo que va a cargo de una parte se le carga como concepto' })
  cargar(@Body(new ZodValidationPipe(ComprobanteInputSchema)) dto: Comprobante, @CurrentUser() user: AuthPrincipal) {
    return this.proveedores.cargarComprobante(ctxDe(user), dto);
  }

  @Post('comprobantes/:id/pagar')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Registra el pago al proveedor' })
  pagar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(PagarComprobanteSchema)) body: z.output<typeof PagarComprobanteSchema>, @CurrentUser() user: AuthPrincipal) {
    return this.proveedores.pagar(ctxDe(user), id, body.fecha, body.medio);
  }

  @Post('comprobantes/:id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula un comprobante cargado por error, con motivo' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AnularConMotivoSchema)) body: z.output<typeof AnularConMotivoSchema>, @CurrentUser() user: AuthPrincipal) {
    return this.proveedores.anular(ctxDe(user), id, body.motivo);
  }
}
