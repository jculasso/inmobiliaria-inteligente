import { Module } from '@nestjs/common';
import { DomainEventsService } from '../../common/domain-events.service';
import { InformesController } from './informes/informes.controller';
import { InformesService } from './informes/informes.service';
import { SupabaseStorageService } from './informes/supabase-storage.service';
import { KpisController } from './kpis/kpis.controller';
import { KpisService } from './kpis/kpis.service';
import { TasacionesController } from './tasaciones/tasaciones.controller';
import { TasacionesService } from './tasaciones/tasaciones.service';

/** Módulo Tasador de Propiedades: CRUD de tasaciones + informes en PDF + KPIs/dashboard. */
@Module({
  controllers: [TasacionesController, InformesController, KpisController],
  providers: [TasacionesService, InformesService, SupabaseStorageService, DomainEventsService, KpisService],
})
export class TasadorModule {}
