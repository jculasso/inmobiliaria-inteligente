import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  ArchivarProtocoloSchema,
  IniciarProtocoloSchema,
  ProtocoloFiltroSchema,
  ROLES_REPORTE_PROTOCOLO,
  UpdateAccionSchema,
  UpdateProtocoloSchema,
  type ArchivarProtocolo,
  type IniciarProtocolo,
  type ProtocoloFiltro,
  type UpdateAccion,
  type UpdateProtocolo,
} from '@vacker/types';
import { CurrentUser, Modulo, Roles } from '../../auth/decorators';
import type { AuthPrincipal } from '../../auth/auth-principal';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ctxDe } from '../tablero/tablero.util';
import { ProtocolosService } from './protocolos.service';

/** Query de los endpoints que solo aceptan el toggle "ver solo lo mío". */
const VerTodoSchema = z.object({ verTodo: z.coerce.boolean().optional() });
type VerTodoQuery = z.infer<typeof VerTodoSchema>;

const ROLES_MODULO = ['vendedor', 'team_leader', 'direccion', 'admin_tenant'] as const;

@ApiTags('protocolo')
@ApiBearerAuth()
@Controller('protocolo')
@Modulo('protocolo')
export class ProtocolosController {
  constructor(private readonly protocolos: ProtocolosService) {}

  @Get('captadas')
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Tasaciones captadas sin protocolo iniciado (scope por rol)' })
  captadas(
    @Query(new ZodValidationPipe(VerTodoSchema)) query: VerTodoQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.listarCandidatas(query.verTodo ?? false, ctxDe(user));
  }

  @Get('kpis')
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'KPIs del dashboard (activas, alertas críticas, avance promedio)' })
  kpis(
    @Query(new ZodValidationPipe(VerTodoSchema)) query: VerTodoQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.kpis(query.verTodo ?? false, ctxDe(user));
  }

  // Va ANTES de @Get(':id') a propósito: si no, Nest toma 'reporte-semanal'
  // como si fuera un id y responde 404.
  @Get('reporte-semanal')
  @Roles(...ROLES_REPORTE_PROTOCOLO)
  @ApiOperation({
    summary: 'Reporte semanal de alertas agrupado por vendedor (el mismo que sale por mail)',
  })
  reporteSemanal(@CurrentUser() user: AuthPrincipal) {
    return this.protocolos.reporteSemanal(ctxDe(user));
  }

  @Get()
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Lista protocolos (scope por rol; filtros estado/año)' })
  list(
    @Query(new ZodValidationPipe(ProtocoloFiltroSchema)) filtro: ProtocoloFiltro,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.list(filtro, ctxDe(user));
  }

  @Get(':id')
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Detalle de un protocolo con sus 29 acciones' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.protocolos.getOne(id, ctxDe(user));
  }

  @Post()
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Inicia el protocolo de una tasación captada' })
  iniciar(
    @Body(new ZodValidationPipe(IniciarProtocoloSchema)) dto: IniciarProtocolo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.iniciar(dto, ctxDe(user));
  }

  @Patch(':id')
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Actualiza datos, métricas comerciales y análisis' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProtocoloSchema)) dto: UpdateProtocolo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.update(id, dto, ctxDe(user));
  }

  @Patch(':id/acciones/:accionId')
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Actualiza una acción del checklist' })
  updateAccion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('accionId', ParseUUIDPipe) accionId: string,
    @Body(new ZodValidationPipe(UpdateAccionSchema)) dto: UpdateAccion,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.updateAccion(id, accionId, dto, ctxDe(user));
  }

  @Post(':id/archivar')
  @Roles(...ROLES_MODULO)
  @ApiOperation({ summary: 'Archiva la propiedad (fecha + motivo)' })
  archivar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ArchivarProtocoloSchema)) dto: ArchivarProtocolo,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.protocolos.archivar(id, dto, ctxDe(user));
  }

  @Post(':id/desarchivar')
  @Roles('team_leader', 'direccion', 'admin_tenant')
  @ApiOperation({ summary: 'Reabre una propiedad archivada por error' })
  desarchivar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.protocolos.desarchivar(id, ctxDe(user));
  }
}
