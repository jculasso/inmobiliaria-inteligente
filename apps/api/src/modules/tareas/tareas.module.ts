import { Module } from '@nestjs/common';
import { ProtocoloModule } from '../protocolo/protocolo.module';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';

/** Tareas programadas que dispara un cron externo (GitHub Actions). */
@Module({
  imports: [ProtocoloModule],
  controllers: [TareasController],
  providers: [TareasService],
})
export class TareasModule {}
