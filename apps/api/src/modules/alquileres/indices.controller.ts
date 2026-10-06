import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IndicesQuerySchema, ROLES_ADMINISTRACION_ALQUILERES, type IndicesQuery } from '@vacker/types';
import { Modulo, Roles } from '../../auth/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { IndicesConsultaService } from './indices-consulta.service';

/** Los índices de ajuste: ICL (BCRA) e IPC (INDEC), para consultarlos. */
@ApiTags('alquileres')
@ApiBearerAuth()
@Controller('alquileres/indices')
@Modulo('alquileres')
export class IndicesController {
  constructor(private readonly indices: IndicesConsultaService) {}

  @Get()
  @Roles(...ROLES_ADMINISTRACION_ALQUILERES)
  @ApiOperation({ summary: 'Valores del ICL (por día, en un rango) o del IPC (por mes, con variación mensual e interanual)' })
  @ApiQuery({ name: 'indice', required: false, enum: ['ICL', 'IPC'] })
  @ApiQuery({ name: 'desde', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'hasta', required: false, example: '2026-10-06' })
  listar(@Query(new ZodValidationPipe(IndicesQuerySchema)) q: IndicesQuery) {
    return this.indices.listar(q);
  }
}
