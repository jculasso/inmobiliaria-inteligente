import { Module } from '@nestjs/common';
import { TasacionesController } from './tasaciones/tasaciones.controller';
import { TasacionesService } from './tasaciones/tasaciones.service';

/** Módulo Tasador de Propiedades: CRUD de tasaciones (Sprint 1). */
@Module({
  controllers: [TasacionesController],
  providers: [TasacionesService],
})
export class TasadorModule {}
