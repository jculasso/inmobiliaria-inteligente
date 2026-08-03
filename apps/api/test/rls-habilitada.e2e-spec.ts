import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TABLAS } from './aislamiento.fixtures';

/**
 * Guardia: ninguna tabla del esquema `public` puede quedar sin RLS.
 *
 * El aislamiento entre inmobiliarias no lo garantiza el código de la
 * aplicación sino PostgreSQL, y solo si la tabla tiene RLS habilitada. Una
 * tabla nueva **nace sin RLS**: si nadie se acuerda de activarla en la
 * migración, queda abierta y no hay ningún síntoma — las consultas funcionan,
 * las pantallas se ven bien, y los datos de una inmobiliaria son legibles
 * desde otra.
 *
 * Este test es lo que evita que la tabla 17 nazca así.
 *
 * Va contra la base de pruebas, que se levanta aplicando las mismas
 * migraciones que producción: lo que se comprueba es el esquema, no los datos.
 */

const URL_DIRECTA = process.env.TEST_DIRECT_URL;
const suite = URL_DIRECTA ? describe : describe.skip;

/**
 * Tablas que pueden estar sin RLS, con el motivo de cada una.
 *
 * Agregar una entrada acá es una decisión, no un trámite: significa afirmar
 * que esa tabla no contiene datos de ninguna inmobiliaria.
 */
const SIN_RLS_PERMITIDO: Record<string, string> = {
  // La lleva Prisma para saber qué migraciones aplicó. No tiene tenant_id ni
  // dato de negocio: es el historial del esquema.
  _prisma_migrations: 'Historial de migraciones de Prisma. No contiene datos de negocio.',
};

suite('Guardia de RLS', () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: URL_DIRECTA });
    await db.$connect();
  }, 60_000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('toda tabla de `public` tiene RLS habilitada', async () => {
    const abiertas = await db.$queryRawUnsafe<{ relname: string }[]>(`
      SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND NOT c.relrowsecurity
       ORDER BY c.relname
    `);

    const sinJustificar = abiertas
      .map((t) => t.relname)
      .filter((t) => !(t in SIN_RLS_PERMITIDO));

    expect(
      sinJustificar,
      sinJustificar.length
        ? `Estas tablas están SIN RLS y quedan abiertas entre inmobiliarias: ` +
            `${sinJustificar.join(', ')}. Agregá ALTER TABLE … ENABLE ROW LEVEL SECURITY y su ` +
            `policy tenant_isolation en la migración, o justificá la excepción en ` +
            `SIN_RLS_PERMITIDO de este archivo.`
        : '',
    ).toEqual([]);
  });

  it('toda tabla con RLS tiene además su policy de aislamiento', async () => {
    // RLS habilitada sin ninguna policy no aísla: niega todo, y el síntoma es
    // una pantalla vacía en vez de una fuga. Es un error distinto pero del
    // mismo descuido, y conviene detectarlo acá.
    const sinPolicy = await db.$queryRawUnsafe<{ relname: string }[]>(`
      SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND c.relrowsecurity
         AND NOT EXISTS (
           SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = c.relname
         )
       ORDER BY c.relname
    `);

    expect(sinPolicy.map((t) => t.relname)).toEqual([]);
  });

  /**
   * El test de aislamiento recorre una lista de tablas escrita a mano
   * (`TABLAS`, en aislamiento.fixtures.ts). Si entra una tabla al esquema y
   * nadie la agrega a esa lista, el aislamiento de esa tabla no se verifica —
   * y el test de aislamiento sigue en verde, que es la peor forma de fallar.
   *
   * Esto compara las dos listas y obliga a que crezcan juntas.
   */
  it('el test de aislamiento cubre todas las tablas del esquema', async () => {
    const enLaBase = await db.$queryRawUnsafe<{ relname: string }[]>(`
      SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND c.relrowsecurity
       ORDER BY c.relname
    `);

    const cubiertas = new Set(TABLAS.map((t) => t.tabla));
    const sinCubrir = enLaBase.map((t) => t.relname).filter((t) => !cubiertas.has(t));

    expect(
      sinCubrir,
      sinCubrir.length
        ? `Estas tablas tienen RLS pero el test de aislamiento no las prueba: ` +
            `${sinCubrir.join(', ')}. Agregalas a TABLAS en test/aislamiento.fixtures.ts.`
        : '',
    ).toEqual([]);
  });
});
