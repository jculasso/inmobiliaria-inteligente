import { Module } from '@nestjs/common';
import { AlquileresController } from './alquileres.controller';
import { AlquileresService } from './alquileres.service';
import { CobrosController } from './cobros.controller';
import { CobrosService } from './cobros.service';
import { ConceptosController } from './conceptos.controller';
import { ConceptosService } from './conceptos.service';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { IndexacionesController } from './indexaciones.controller';
import { IndexacionesService } from './indexaciones.service';
import { FuentesIndices, IndicesService } from './indices.service';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';
import { PropiedadesAlquilerController } from './propiedades.controller';
import { PropiedadesAlquilerService } from './propiedades.service';
import { ReciboService } from './recibo.service';

/** Módulo Alquileres: administración de contratos de alquiler. */
@Module({
  controllers: [AlquileresController, PersonasController, PropiedadesAlquilerController, ContratosController, IndexacionesController, ConceptosController, CobrosController],
  providers: [
    AlquileresService,
    PersonasService,
    PropiedadesAlquilerService,
    ContratosService,
    ConceptosService,
    CobrosService,
    ReciboService,
    IndexacionesService,
    IndicesService,
    FuentesIndices,
  ],
  // El importador de índices lo dispara la tarea diaria (módulo Tareas).
  exports: [IndicesService],
})
export class AlquileresModule {}
