import { Module } from '@nestjs/common';
import { PublicacionController } from './publicacion.controller';
import { PublicacionService } from './publicacion.service';

/** Módulo de Publicación: credencial de Tokko y, más adelante, el feed de propiedades. */
@Module({
  controllers: [PublicacionController],
  providers: [PublicacionService],
})
export class PublicacionModule {}
