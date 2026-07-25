import { Module } from '@nestjs/common';
import { SupabaseAdminService } from '../admin/supabase-admin.service';
import { MeController } from './me.controller';
import { PasswordController } from './password.controller';
import { PasswordService } from './password.service';

@Module({
  controllers: [MeController, PasswordController],
  providers: [PasswordService, SupabaseAdminService],
})
export class MeModule {}
