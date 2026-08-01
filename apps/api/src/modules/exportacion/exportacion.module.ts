import { Module } from '@nestjs/common';
import { ExportacionController } from './exportacion.controller';
import { ExportacionService } from './exportacion.service';

/** "Sus datos son suyos": descarga completa de lo que tiene la inmobiliaria. */
@Module({
  controllers: [ExportacionController],
  providers: [ExportacionService],
})
export class ExportacionModule {}
