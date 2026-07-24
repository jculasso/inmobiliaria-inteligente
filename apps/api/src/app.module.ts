import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { TableroModule } from './modules/tablero/tablero.module';
import { TasadorModule } from './modules/tasador/tasador.module';
import { TodoModule } from './modules/todo/todo.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // dotenv-cli ya inyecta el .env raíz; estos paths son respaldo.
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    // Contexto por request (tenant/user/roles) accesible en la capa de datos.
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    AuthModule,
    HealthModule,
    MeModule,
    TenantsModule,
    UsuariosModule,
    TableroModule,
    TasadorModule,
    TodoModule,
    AdminModule,
  ],
})
export class AppModule {}
