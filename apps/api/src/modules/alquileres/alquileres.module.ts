import { Module } from '@nestjs/common';
import { AlquileresController } from './alquileres.controller';
import { AlquileresService } from './alquileres.service';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';
import { PropiedadesAlquilerController } from './propiedades.controller';
import { PropiedadesAlquilerService } from './propiedades.service';

/** Módulo Alquileres: administración de contratos de alquiler. */
@Module({
  controllers: [AlquileresController, PersonasController, PropiedadesAlquilerController, ContratosController],
  providers: [AlquileresService, PersonasService, PropiedadesAlquilerService, ContratosService],
})
export class AlquileresModule {}
