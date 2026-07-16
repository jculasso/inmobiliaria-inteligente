import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_PROVIDER } from './auth-provider.interface';
import { SupabaseAuthProvider } from './supabase-auth.provider';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [
    { provide: AUTH_PROVIDER, useClass: SupabaseAuthProvider },
    // Orden importante: AuthGuard primero (arma el principal), luego RolesGuard.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
