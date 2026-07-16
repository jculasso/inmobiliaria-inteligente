import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { TENANT_CTX_KEY, type TenantContext } from './tenant-context';

/**
 * Ejecuta queries de negocio con RLS efectiva. Abre una transacción, setea el
 * contexto por request (`app.tenant_id`, `app.user_id`) y baja el rol a
 * `authenticated` (sin BYPASSRLS) antes de correr el callback. La policy
 * `tenant_isolation` de cada tabla filtra por `app.tenant_id`.
 */
@Injectable()
export class TenantPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * @param fn  callback que recibe el cliente transaccional ya acotado al tenant.
   * @param ctx contexto explícito; si se omite, se toma del CLS del request.
   */
  async withTenant<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ctx?: TenantContext,
  ): Promise<T> {
    const context = ctx ?? this.cls.get<TenantContext>(TENANT_CTX_KEY);
    if (!context?.tenantId || !context?.userId) {
      throw new InternalServerErrorException('Falta el contexto de tenant para la consulta.');
    }

    return this.prisma.$transaction(async (tx) => {
      // set_config transaction-local (tercer arg = true). Parametrizado → sin inyección.
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, context.tenantId);
      await tx.$executeRawUnsafe(`SELECT set_config('app.user_id', $1, true)`, context.userId);
      // Baja de privilegios: a partir de acá RLS aplica sobre las queries del callback.
      await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
      return fn(tx);
    });
  }
}
