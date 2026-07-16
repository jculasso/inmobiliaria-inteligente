import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma base. Se conecta con el rol `postgres` (BYPASSRLS), por lo que
 * NO se debe usar directamente para queries de negocio con aislamiento: para eso
 * está `TenantPrismaService.withTenant()`, que baja a rol `authenticated`.
 * Uso directo permitido: migraciones lógicas, seed, y operaciones de admin_plataforma.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
