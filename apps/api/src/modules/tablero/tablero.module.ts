import { Module } from '@nestjs/common';
import { KpisController } from './kpis/kpis.controller';
import { KpisService } from './kpis/kpis.service';
import { OperacionesController } from './operaciones/operaciones.controller';
import { OperacionesService } from './operaciones/operaciones.service';
import { VendedoresController } from './vendedores/vendedores.controller';
import { VendedoresService } from './vendedores/vendedores.service';

/** Módulo Tablero Comercial (Paso 3): operaciones, vendedores y KPIs. */
@Module({
  controllers: [OperacionesController, VendedoresController, KpisController],
  providers: [OperacionesService, VendedoresService, KpisService],
})
export class TableroModule {}
