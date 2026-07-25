import { Module } from '@nestjs/common';
import { SupabaseStorageService } from '../../common/supabase-storage.service';
import { ProtocolosController } from './protocolos.controller';
import { ProtocolosService } from './protocolos.service';

/** Módulo Protocolo 5 Semanas: seguimiento de la comercialización de una captación. */
@Module({
  controllers: [ProtocolosController],
  providers: [ProtocolosService, SupabaseStorageService],
})
export class ProtocoloModule {}
