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

    return this.prisma.$transaction(
      async (tx) => {
        // Los 2 set_config van en un solo SELECT (1 round trip en vez de 2) —
        // con Supabase en sa-east-1 y Render sin región en Sudamérica, cada
        // round trip a la base paga latencia entre continentes; concentrar
        // setup en menos viajes de red importa mucho acá. Parametrizado → sin inyección.
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)`,
          context.tenantId,
          context.userId,
        );
        // Baja de privilegios: a partir de acá RLS aplica sobre las queries del callback.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
        return fn(tx);
      },
      // Los defaults de Prisma (timeout 5s, maxWait 2s) alcanzan en condiciones
      // normales, pero varios servicios encadenan 5-7 queries dentro de esta
      // misma transacción (ej. VendedoresService.update). En el free tier de
      // Render, con latencia de red más alta hacia Supabase, eso puede superar
      // los 5s y Prisma cierra la transacción a mitad de camino — el síntoma es
      // un P2028 "Transaction not found" en la query siguiente, que el filtro
      // de excepciones traduce (mal) como "restricción de datos". Se generan
      // márgenes más amplios para que una request lenta no aborte a mitad de camino.
      { timeout: 15_000, maxWait: 10_000 },
    );
  }
}
