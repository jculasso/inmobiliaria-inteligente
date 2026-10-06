import { Module } from '@nestjs/common';
import { SupabaseStorageService } from '../../common/supabase-storage.service';
import { AlquileresController } from './alquileres.controller';
import { AlquileresService } from './alquileres.service';
import { CobrosController } from './cobros.controller';
import { CobrosService } from './cobros.service';
import { ConceptosController } from './conceptos.controller';
import { ConceptosService } from './conceptos.service';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { IndexacionesController } from './indexaciones.controller';
import { LiquidacionesController } from './liquidaciones.controller';
import { LiquidacionesService } from './liquidaciones.service';
import { IndexacionesService } from './indexaciones.service';
import { FuentesIndices, IndicesService } from './indices.service';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';
import { PropiedadesAlquilerController } from './propiedades.controller';
import { PropiedadesAlquilerService } from './propiedades.service';
import { ReciboService } from './recibo.service';
import { FirmaAvisosController, FirmaController } from './firma/firma.controller';
import { FirmaAvisosService } from './firma/firma-avisos.service';
import { FirmaService } from './firma/firma.service';
import { FirmaManual, PROVEEDORES_FIRMA, type ProveedorFirma } from './firma/proveedor-firma';
import { TableroAlquileresController } from './tablero-alquileres.controller';
import { TableroAlquileresService } from './tablero-alquileres.service';

/** Módulo Alquileres: administración de contratos de alquiler. */
@Module({
  controllers: [AlquileresController, PersonasController, PropiedadesAlquilerController, ContratosController, IndexacionesController, ConceptosController, CobrosController, LiquidacionesController, TableroAlquileresController, FirmaController, FirmaAvisosController],
  providers: [
    AlquileresService,
    PersonasService,
    PropiedadesAlquilerService,
    ContratosService,
    ConceptosService,
    CobrosService,
    LiquidacionesService,
    TableroAlquileresService,
    FirmaService,
    FirmaAvisosService,
    SupabaseStorageService,
    FirmaManual,
    // Los adaptadores de firma, por nombre (regla 35). Sumar un proveedor es
    // escribir su adaptador y agregarlo acá.
    {
      provide: PROVEEDORES_FIRMA,
      useFactory: (...adaptadores: ProveedorFirma[]) => new Map(adaptadores.map((a) => [a.nombre, a])),
      inject: [FirmaManual],
    },
    ReciboService,
    IndexacionesService,
    IndicesService,
    FuentesIndices,
  ],
  // El importador de índices lo dispara la tarea diaria (módulo Tareas).
  exports: [IndicesService],
})
export class AlquileresModule {}
