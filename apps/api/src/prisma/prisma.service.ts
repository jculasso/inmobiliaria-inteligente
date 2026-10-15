import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import { conectorDelEntorno, opcionesDelCliente, type Conector } from './conexion';

/** Para pasarle opciones al cliente fuera de la API: tests, siembra, medición. */
export const OPCIONES_PRISMA = Symbol('OPCIONES_PRISMA');

export interface OpcionesPrisma {
  /** Por defecto, `DATABASE_URL`. */
  url?: string;
  /** Por defecto, `DATABASE_CONECTOR` (ver `conexion.ts`). */
  conector?: Conector;
  log?: Prisma.PrismaClientOptions['log'];
}

/**
 * Cliente Prisma base. Se conecta con el rol `postgres` (BYPASSRLS), por lo que
 * NO se debe usar directamente para queries de negocio con aislamiento: para eso
 * está `TenantPrismaService.withTenant()`, que baja a rol `authenticated`.
 * Uso directo permitido: migraciones lógicas, seed, y operaciones de admin_plataforma.
 *
 * Cómo llega a la base —el adaptador de node-postgres o el motor de Prisma—
 * está en `conexion.ts`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly conector: Conector;

  constructor(@Optional() @Inject(OPCIONES_PRISMA) opciones: OpcionesPrisma = {}) {
    const conector = opciones.conector ?? conectorDelEntorno();
    super(opcionesDelCliente(opciones.url ?? process.env.DATABASE_URL, conector, opciones.log));
    this.conector = conector;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
