import { Module } from '@nestjs/common';
import { DomainEventsService } from '../../common/domain-events.service';
import { FotosController } from './fotos/fotos.controller';
import { FotosService } from './fotos/fotos.service';
import { InformesController } from './informes/informes.controller';
import { InformesService } from './informes/informes.service';
import { SupabaseStorageService } from './informes/supabase-storage.service';
import { KpisController } from './kpis/kpis.controller';
import { KpisService } from './kpis/kpis.service';
import { ReporteController } from './reporte/reporte.controller';
import { ReporteService } from './reporte/reporte.service';
import { TasacionesController } from './tasaciones/tasaciones.controller';
import { TasacionesService } from './tasaciones/tasaciones.service';

/** Módulo Tasador de Propiedades: CRUD de tasaciones + informes en PDF + KPIs/dashboard. */
@Module({
  controllers: [TasacionesController, InformesController, KpisController, FotosController, ReporteController],
  providers: [
    TasacionesService,
    InformesService,
    SupabaseStorageService,
    DomainEventsService,
    KpisService,
    FotosService,
    ReporteService,
  ],
})
export class TasadorModule {}
