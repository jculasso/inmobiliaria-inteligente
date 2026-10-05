import { Module } from '@nestjs/common';
import { AlquileresModule } from '../alquileres/alquileres.module';
import { ProtocoloModule } from '../protocolo/protocolo.module';
import { TareasController } from './tareas.controller';
import { TareasService } from './tareas.service';

/** Tareas programadas que dispara un cron externo (GitHub Actions). */
@Module({
  imports: [ProtocoloModule, AlquileresModule],
  controllers: [TareasController],
  providers: [TareasService],
})
export class TareasModule {}
