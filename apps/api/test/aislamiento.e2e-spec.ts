import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import type { TenantContext } from '../src/prisma/tenant-context';
import type { IdsDeTenant } from './aislamiento.fixtures';
import { TABLAS, limpiar, nuevosIds, sembrar, valorEditable } from './aislamiento.fixtures';

/**
 * Aislamiento entre inmobiliarias, POR LA RUTA REAL.
 *
 * La versión anterior de este test se conectaba con el cliente `pg` crudo a
 * `DIRECT_URL` (puerto 5432) y **reimplementaba a mano** el `set_config` que
 * hace la aplicación. Eso probaba que las policies estuvieran bien escritas,
 * pero no probaba el mecanismo que corre en producción: si alguien rompía
 * `TenantPrismaService`, el test seguía en verde.
 *
 * Esta versión atraviesa el mismo camino que un request real:
 *
 * - **Cliente Prisma**, no `pg`.
 * - **`TEST_DATABASE_URL` a través del pooler en modo transaction**, que es la
 *   forma en la que se conecta la API (`schema.prisma` usa `DATABASE_URL` con
 *   `pgbouncer=true`).
 * - **El `TenantPrismaService` de verdad**, importado de `src/`. No hay una
 *   copia del `set_config` en este archivo: si lo que corre en producción
 *   cambia, este test cambia con él o falla.
 *
 * Lo único que se sustituye es `ClsService`, el almacén por request de NestJS.
 * `withTenant` solo lo consulta cuando NO se le pasa contexto explícito, y acá
 * se le pasa siempre. El SQL que se ejecuta es exactamente el mismo.
 *
 * NUNCA corre contra la base productiva: exige variables propias y además
 * rechaza cualquier URL que parezca de producción (ver `esProduccion`).
 */

const URL_POOLER = process.env.TEST_DATABASE_URL;
const URL_DIRECTA = process.env.TEST_DIRECT_URL;

/**
 * Freno de mano. Este test SIEMBRA Y BORRA filas de verdad — no puede correr
 * contra la base de un cliente. La productiva vive en Supabase y hoy no tiene
 * copias automáticas, así que el costo de equivocarse no se deshace.
 */
function esProduccion(url: string): boolean {
  return /supabase\.(com|co|net)/i.test(url) || /pooler\.supabase/i.test(url);
}

const hayBase = Boolean(URL_POOLER && URL_DIRECTA);
if (hayBase && (esProduccion(URL_POOLER!) || esProduccion(URL_DIRECTA!))) {
  throw new Error(
    'TEST_DATABASE_URL/TEST_DIRECT_URL apuntan a Supabase. Este test escribe y borra: ' +
      'usá una base de pruebas descartable.',
  );
}
const suite = hayBase ? describe : describe.skip;

suite('Aislamiento entre inmobiliarias (ruta real: Prisma + pooler)', () => {
  /** Cliente sin RLS, para sembrar y limpiar. Va por la conexión directa. */
  let siembra: PrismaClient;
  /** El mismo par de servicios que usa la API, apuntando al pooler. */
  let prisma: PrismaService;
  let tenantPrisma: TenantPrismaService;

  const idsA = nuevosIds(1);
  const idsB = nuevosIds(2);
  const ctxA: TenantContext = { tenantId: idsA.tenant, userId: idsA.usuario, roles: [] };
  const ctxB: TenantContext = { tenantId: idsB.tenant, userId: idsB.usuario, roles: [] };

  beforeAll(async () => {
    siembra = new PrismaClient({ datasourceUrl: URL_DIRECTA });
    await siembra.$connect();
    await sembrar(siembra, idsA);
    await sembrar(siembra, idsB);

    prisma = new PrismaService({ datasourceUrl: URL_POOLER });
    await prisma.$connect();

    // `withTenant` solo mira el CLS si no recibe contexto; acá siempre lo recibe.
    const clsInerte = { get: () => undefined } as unknown as ClsService;
    tenantPrisma = new TenantPrismaService(prisma, clsInerte);
  }, 60_000);

  afterAll(async () => {
    await limpiar(siembra, [idsA, idsB]);
    await siembra.$disconnect();
    await prisma?.$disconnect();
  }, 60_000);

  /**
   * Acceso al delegado de Prisma por nombre (`tx.operacion`, `tx.usuario`…).
   * Es lo que permite recorrer las 16 tablas sin escribir 16 bloques iguales.
   */
  type Delegado = {
    findMany: (a: unknown) => Promise<unknown>;
    create: (a: unknown) => Promise<unknown>;
    updateMany: (a: unknown) => Promise<unknown>;
  };
  function delegado(tx: unknown, modelo: string): Delegado {
    const d = (tx as Record<string, Delegado | undefined>)[modelo];
    if (!d) throw new Error(`No existe el delegado de Prisma "${modelo}"`);
    return d;
  }

  describe.each(TABLAS.map((t) => [t.tabla, t] as const))('tabla %s', (_nombre, t) => {
    it('desde el tenant A, un SELECT no trae filas del tenant B', async () => {
      const visibles = await tenantPrisma.withTenant(async (tx) => {
        return (await delegado(tx, t.modelo).findMany({
          where: { tenantId: { in: [idsA.tenant, idsB.tenant] } },
          select: { tenantId: true },
        })) as { tenantId: string }[];
      }, ctxA);

      expect(visibles.length).toBeGreaterThan(0);
      expect(visibles.every((f) => f.tenantId === idsA.tenant)).toBe(true);
    });

    it('desde el tenant A, un INSERT con el tenant_id del B es rechazado', async () => {
      /*
       * La fila intrusa tiene que ser válida en TODO salvo en que pertenece a
       * otra inmobiliaria. Por eso se regenera únicamente su clave primaria y
       * se dejan intactas las foráneas, que apuntan a filas reales del tenant
       * B. Si se regeneraran todas, el INSERT fallaría por integridad
       * referencial y este test daría verde sin haber ejercido RLS ni una vez.
       */
      const idsIntrusos: IdsDeTenant = { ...idsB, [t.claveId]: randomUUID() };
      const fila = t.filaIntrusa
        ? t.filaIntrusa(idsB.tenant, idsB)
        : t.fila(idsB.tenant, idsIntrusos);

      await expect(
        tenantPrisma.withTenant(async (tx) => {
          return delegado(tx, t.modelo).create({ data: fila });
        }, ctxA),
      ).rejects.toThrow();
    });

    it('la fila intrusa SÍ entra desde su propio tenant (o el test anterior no probaría RLS)', async () => {
      /*
       * Control de la prueba de arriba. Sin esto, un INSERT que falle por
       * cualquier otro motivo —una columna faltante, una clave foránea rota, un
       * índice único— se leería como "RLS lo frenó". Acá se comprueba que la
       * misma fila, desde el contexto de su dueño, entra sin problemas: lo
       * único que cambia entre los dos casos es el tenant del contexto.
       */
      const idsIntrusos: IdsDeTenant = { ...idsB, [t.claveId]: randomUUID() };
      const fila = t.filaIntrusa
        ? t.filaIntrusa(idsB.tenant, idsB)
        : t.fila(idsB.tenant, idsIntrusos);

      await expect(
        tenantPrisma.withTenant(async (tx) => {
          return delegado(tx, t.modelo).create({ data: fila });
        }, ctxB),
      ).resolves.toBeDefined();
    });

    it('desde el tenant A, un UPDATE sobre una fila del B afecta cero filas', async () => {
      const afectadas = await tenantPrisma.withTenant(async (tx) => {
        const r = (await delegado(tx, t.modelo).updateMany({
          where: { tenantId: idsB.tenant },
          data: { [t.campoEditable]: valorEditable(t) },
        })) as { count: number };
        return r.count;
      }, ctxA);

      expect(afectadas).toBe(0);
    });
  });

  it('sin contexto de tenant no se puede consultar (falla antes de tocar la base)', async () => {
    await expect(
      // @ts-expect-error se fuerza a propósito el caso de contexto incompleto
      tenantPrisma.withTenant(async (tx) => tx.tenant.findMany(), { tenantId: '', userId: '' }),
    ).rejects.toThrow();
  });

  /**
   * El caso que la versión anterior no podía probar.
   *
   * `set_config(..., is_local = true)` revierte al terminar la transacción, que
   * es el mismo instante en que el pooler en modo transaction devuelve la
   * conexión física al lote. Si eso no fuera así, una transacción del tenant B
   * podría heredar el `app.tenant_id` que dejó pegado una del tenant A y ver
   * filas ajenas.
   *
   * Acá se fuerza el solapamiento: veinte transacciones alternando A y B sobre
   * el mismo pool, cada una durmiendo dentro de la transacción para que se
   * pisen entre sí. Cada una tiene que ver únicamente lo suyo.
   */
  it('con transacciones de tenants distintos solapadas, ninguna ve filas de la otra', async () => {
    const CORRIDAS = 20;

    const corrida = async (i: number) => {
      const propio = i % 2 === 0 ? idsA : idsB;
      const ctx = i % 2 === 0 ? ctxA : ctxB;

      return tenantPrisma.withTenant(async (tx) => {
        // Retiene la conexión un rato para que las demás transacciones estén
        // vivas al mismo tiempo. Sin esto podrían ejecutarse en serie y el test
        // no probaría nada.
        await tx.$queryRawUnsafe('SELECT pg_sleep(0.05)');

        const filas = (await tx.usuario.findMany({
          where: { tenantId: { in: [idsA.tenant, idsB.tenant] } },
          select: { tenantId: true },
        })) as { tenantId: string }[];

        const tenantVisto = await tx.$queryRawUnsafe<{ v: string }[]>(
          `SELECT current_setting('app.tenant_id', true) AS v`,
        );

        return {
          i,
          esperado: propio.tenant,
          filasAjenas: filas.filter((f) => f.tenantId !== propio.tenant).length,
          gucVisto: tenantVisto[0]?.v,
          ctxPedido: ctx.tenantId,
        };
      }, ctx);
    };

    const resultados = await Promise.all(
      Array.from({ length: CORRIDAS }, (_, i) => corrida(i)),
    );

    for (const r of resultados) {
      expect(r.filasAjenas, `la corrida ${r.i} vio filas de la otra inmobiliaria`).toBe(0);
      expect(r.gucVisto, `la corrida ${r.i} corrió con el tenant equivocado`).toBe(r.ctxPedido);
    }
  }, 60_000);

  /**
   * Después de una transacción, la conexión no puede quedar con el rol bajado
   * ni con el tenant puesto: si quedara, el pedido siguiente —de otra
   * inmobiliaria— lo heredaría.
   */
  it('al terminar la transacción, el contexto no queda pegado a la conexión', async () => {
    await tenantPrisma.withTenant(async (tx) => tx.tenant.findMany(), ctxA);

    const filas = await prisma.$queryRawUnsafe<{ tenant_guc: string | null; rol: string }[]>(
      `SELECT current_setting('app.tenant_id', true) AS tenant_guc, current_user AS rol`,
    );
    const estado = filas[0];
    expect(estado).toBeDefined();
    expect(estado!.tenant_guc === null || estado!.tenant_guc === '').toBe(true);
    expect(estado!.rol).not.toBe('authenticated');
  });
});
