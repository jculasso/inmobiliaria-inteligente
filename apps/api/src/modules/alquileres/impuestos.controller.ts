import {
  Body,
  Controller,
  Delete,
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
  AnularConMotivoSchema,
  BoletasQuerySchema,
  CuentaServicioInputSchema,
  LoteBoletasSchema,
  PagarBoletaSchema,
  PeriodoSchema,
  PolizaInputSchema,
  ROLES_ADMINISTRACION_ALQUILERES,
  ServicioInputSchema,
  type CuentaServicio,
  type LoteBoletas,
  type Poliza,
  type ServicioInput,
} from '@vacker/types';
import { z } from 'zod';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ImpuestosService } from './impuestos.service';

const PlanillaQuerySchema = z.object({ periodo: PeriodoSchema });
const PorContratoQuerySchema = z.object({ contratoId: z.string().uuid().optional() });
const PorPropiedadQuerySchema = z.object({ propiedadId: z.string().uuid().optional() });

/** Impuestos, servicios y pólizas (entrega 19). */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres')
@Modulo('alquileres')
export class ImpuestosController {
  constructor(private readonly impuestos: ImpuestosService) {}

  @Get('servicios')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'El catálogo de impuestos y servicios de la inmobiliaria' })
  servicios() {
    return this.impuestos.servicios();
  }

  @Post('servicios/sugeridos')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Carga los impuestos y servicios habituales (API, TGI, EPE, gas, agua, expensas)',
  })
  sugeridos(@CurrentUser() user: AuthPrincipal) {
    return this.impuestos.cargarSugeridos(ctxDe(user));
  }

  @Post('servicios')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Suma un impuesto o servicio al catálogo' })
  crearServicio(
    @Body(new ZodValidationPipe(ServicioInputSchema)) dto: ServicioInput,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.guardarServicio(ctxDe(user), null, dto);
  }

  @Patch('servicios/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita un impuesto o servicio del catálogo' })
  editarServicio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ServicioInputSchema)) dto: ServicioInput,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.guardarServicio(ctxDe(user), id, dto);
  }

  @Delete('servicios/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra un impuesto o servicio que ninguna propiedad tiene' })
  borrarServicio(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.impuestos.borrarServicio(ctxDe(user), id);
  }

  @Get('cuentas-servicio')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Los impuestos y servicios de cada propiedad, con su número de cuenta' })
  cuentas(
    @Query(new ZodValidationPipe(PorPropiedadQuerySchema))
    q: z.output<typeof PorPropiedadQuerySchema>,
  ) {
    return this.impuestos.cuentas(q.propiedadId);
  }

  @Post('cuentas-servicio')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Asigna un impuesto o servicio a una propiedad' })
  crearCuenta(
    @Body(new ZodValidationPipe(CuentaServicioInputSchema)) dto: CuentaServicio,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.guardarCuenta(ctxDe(user), null, dto);
  }

  @Patch('cuentas-servicio/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Edita la cuenta de un impuesto o servicio' })
  editarCuenta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CuentaServicioInputSchema)) dto: CuentaServicio,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.guardarCuenta(ctxDe(user), id, dto);
  }

  @Delete('cuentas-servicio/:id')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Borra una cuenta sin boletas' })
  borrarCuenta(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.impuestos.borrarCuenta(ctxDe(user), id);
  }

  @Get('boletas/planilla')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'La planilla del mes: cada cuenta, lo cargado y lo del mes anterior para copiar',
  })
  planilla(
    @Query(new ZodValidationPipe(PlanillaQuerySchema)) q: z.output<typeof PlanillaQuerySchema>,
  ) {
    return this.impuestos.planilla(q.periodo);
  }

  @Post('boletas/lote')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary:
      'Carga varias boletas juntas; lo que va a cargo de una parte se le carga como concepto',
  })
  lote(
    @Body(new ZodValidationPipe(LoteBoletasSchema)) dto: LoteBoletas,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.cargarLote(ctxDe(user), dto);
  }

  @Get('boletas')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Boletas de un mes, o las pendientes vencidas o por vencer (control)' })
  boletas(
    @Query(new ZodValidationPipe(BoletasQuerySchema)) q: z.output<typeof BoletasQuerySchema>,
  ) {
    return this.impuestos.boletas(q);
  }

  @Post('boletas/:id/pagar')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({
    summary: 'Registra el pago de una boleta, o que la parte presentó el comprobante',
  })
  pagar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PagarBoletaSchema)) body: z.output<typeof PagarBoletaSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.pagarBoleta(ctxDe(user), id, body.fecha, body.medio);
  }

  @Post('boletas/:id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula una boleta cargada por error, con motivo' })
  anularBoleta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AnularConMotivoSchema))
    body: z.output<typeof AnularConMotivoSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.anularBoleta(ctxDe(user), id, body.motivo);
  }

  @Get('polizas')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Pólizas de seguro, de todos los contratos o de uno' })
  polizas(
    @Query(new ZodValidationPipe(PorContratoQuerySchema))
    q: z.output<typeof PorContratoQuerySchema>,
  ) {
    return this.impuestos.polizas(q.contratoId);
  }

  @Post('polizas')
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Alta de una póliza: sus cuotas se cargan como boletas' })
  crearPoliza(
    @Body(new ZodValidationPipe(PolizaInputSchema)) dto: Poliza,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.crearPoliza(ctxDe(user), dto);
  }

  @Post('polizas/:id/anular')
  @HttpCode(200)
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Anula una póliza y las cuotas que faltan pagar' })
  anularPoliza(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AnularConMotivoSchema))
    body: z.output<typeof AnularConMotivoSchema>,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.impuestos.anularPoliza(ctxDe(user), id, body.motivo);
  }
}
