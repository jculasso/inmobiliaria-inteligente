import { Module } from '@nestjs/common';
import { SupabaseStorageService } from '../common/supabase-storage.service';
import { AdminTenantsController } from './admin-tenants.controller';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { AdminUsuariosService } from './admin-usuarios.service';
import { SupabaseAdminService } from './supabase-admin.service';

@Module({
  controllers: [AdminTenantsController, AdminUsuariosController],
  providers: [AdminTenantsService, AdminUsuariosService, SupabaseAdminService, SupabaseStorageService],
})
export class AdminModule {}
