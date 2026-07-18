import { Module } from '@nestjs/common';
import { InformesController } from './informes/informes.controller';
import { InformesService } from './informes/informes.service';
import { SupabaseStorageService } from './informes/supabase-storage.service';
import { TasacionesController } from './tasaciones/tasaciones.controller';
import { TasacionesService } from './tasaciones/tasaciones.service';

/** Módulo Tasador de Propiedades: CRUD de tasaciones + generación de informes en PDF. */
@Module({
  controllers: [TasacionesController, InformesController],
  providers: [TasacionesService, InformesService, SupabaseStorageService],
})
export class TasadorModule {}
