import { Module } from '@nestjs/common';
import { SupabaseStorageService } from '../../common/supabase-storage.service';
import { InformeProtocoloController } from './informe/informe-protocolo.controller';
import { InformeProtocoloService } from './informe/informe-protocolo.service';
import { ProtocolosController } from './protocolos.controller';
import { ProtocolosService } from './protocolos.service';

/** Módulo Protocolo 5 Semanas: seguimiento de la comercialización de una captación. */
@Module({
  controllers: [ProtocolosController, InformeProtocoloController],
  providers: [ProtocolosService, InformeProtocoloService, SupabaseStorageService],
})
export class ProtocoloModule {}
