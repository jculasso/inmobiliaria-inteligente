import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import type { TenantContext } from '../src/prisma/tenant-context';
import { bloquearReserva, tomarCandados } from '../src/modules/alquileres/candados';
import { TABLAS, limpiar, nuevosIds, sembrar } from './aislamiento.fixtures';

/**
 * El conector de la API (`src/prisma/conexion.ts`) pasó del motor de Prisma al
 * adaptador de node-postgres (octubre de 2026). Este test prueba que, contra
 * la misma base y por el mismo pooler en modo transaction, los dos devuelven
 * lo MISMO: cada tabla del esquema leída entera —fechas, `@db.Date`,
 * decimales, JSON, booleanos—, las consultas en SQL con sus parámetros, y lo
 * que se escribe con uno leído con el otro.
 *
 * Corre tres veces con la zona horaria del proceso cambiada: una fecha que se
 * corre un día aparece justo cuando la zona no es UTC (Render es UTC; esta
 * máquina, Buenos Aires; Tokio adelanta el día).
 *
 * Mismas variables y mismos frenos que `aislamiento.e2e-spec.ts`.
 */

const URL_POOLER = process.env.TEST_DATABASE_URL;
const URL_DIRECTA = process.env.TEST_DIRECT_URL;
const esProduccion = (url: string) =>
  /supabase\.(com|co|net)/i.test(url) || /pooler\.supabase/i.test(url);
const hayBase = Boolean(URL_POOLER && URL_DIRECTA);
if (hayBase && (esProduccion(URL_POOLER!) || esProduccion(URL_DIRECTA!))) {
  throw new Error(
    'TEST_DATABASE_URL/TEST_DIRECT_URL apuntan a Supabase. Este test escribe y borra: ' +
      'usá una base de pruebas descartable.',
  );
}
const suite = hayBase ? describe : describe.skip;

/**
 * Un valor leído, con su tipo a la vista: `Decimal` y `number` no son lo
 * mismo aunque valgan igual, ni un `Date` y su texto.
 */
function huella(x: unknown): unknown {
  if (x === null || x === undefined) return x;
  if (x instanceof Date) return `fecha:${x.toISOString()}`;
  if (Prisma.Decimal.isDecimal(x)) return `decimal:${(x as Prisma.Decimal).toString()}`;
  if (typeof x === 'bigint') return `bigint:${x.toString()}`;
  if (Buffer.isBuffer(x) || x instanceof Uint8Array)
    return `bytes:${Buffer.from(x).toString('base64')}`;
  if (Array.isArray(x)) return x.map(huella);
  if (typeof x === 'object')
    return Object.fromEntries(
      Object.entries(x as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, huella(v)]),
    );
  return `${typeof x}:${String(x)}`;
}
const ordenadas = (filas: unknown[]) =>
  filas.map(huella).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));

const ZONAS = ['UTC', 'America/Argentina/Buenos_Aires', 'Asia/Tokyo'];

suite('El adaptador pg lee y escribe igual que el motor de Prisma', () => {
  let siembra: PrismaClient;
  let pg: PrismaService;
  let motor: PrismaService;
  let conPg: TenantPrismaService;
  let conMotor: TenantPrismaService;
  const ids = nuevosIds(41);
  const ctx: TenantContext = { tenantId: ids.tenant, userId: ids.usuario, roles: [] };
  const zonaOriginal = process.env.TZ;

  beforeAll(async () => {
    siembra = new PrismaClient({ datasourceUrl: URL_DIRECTA });
    await siembra.$connect();
    await sembrar(siembra, ids);
    // Los dos por el pooler: como corre la API en producción.
    pg = new PrismaService({ url: URL_POOLER, conector: 'pg' });
    motor = new PrismaService({ url: URL_POOLER, conector: 'motor' });
    const cls = { get: () => undefined } as unknown as ClsService;
    conPg = new TenantPrismaService(pg, cls);
    conMotor = new TenantPrismaService(motor, cls);
  }, 60_000);

  afterEach(() => {
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  });

  afterAll(async () => {
    await limpiar(siembra, [ids]);
    await siembra?.$disconnect();
    await pg?.$disconnect();
    await motor?.$disconnect();
  }, 60_000);

  it('la API usa el adaptador salvo que DATABASE_CONECTOR diga «motor»', () => {
    expect(pg.conector).toBe('pg');
    expect(motor.conector).toBe('motor');
  });

  /** Lo mismo por los dos conectores, con RLS, en la zona pedida. */
  async function porLosDos<T>(zona: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    process.env.TZ = zona;
    return {
      pg: await conPg.withTenant(fn, ctx),
      motor: await conMotor.withTenant(fn, ctx),
    };
  }

  describe.each(ZONAS)('con la zona horaria %s', (zona) => {
    it('cada tabla del esquema se lee igual, columna por columna', async () => {
      for (const t of TABLAS) {
        const { pg: a, motor: b } = await porLosDos(zona, (tx) =>
          (tx as unknown as Record<string, { findMany: (x?: unknown) => Promise<unknown[]> }>)[
            t.modelo
          ]!.findMany(),
        );
        expect(a.length, t.tabla).toBeGreaterThan(0);
        expect(ordenadas(a), t.tabla).toEqual(ordenadas(b));
      }
    });

    it('una consulta con relaciones anidadas se lee igual', async () => {
      const { pg: a, motor: b } = await porLosDos(zona, (tx) =>
        tx.alqContrato.findMany({
          include: {
            propiedad: true,
            partes: { include: { persona: true } },
            tramos: { orderBy: { numero: 'asc' } },
            conceptos: true,
          },
        }),
      );
      expect(a.length).toBeGreaterThan(0);
      expect(ordenadas(a)).toEqual(ordenadas(b));
    });

    it('el SQL a mano devuelve los mismos tipos: bigint, numeric, date, timestamptz, jsonb, arreglos', async () => {
      const { pg: a, motor: b } = await porLosDos(
        zona,
        (tx) =>
          tx.$queryRaw<Record<string, unknown>[]>`
          SELECT count(*) AS cuantos, sum(k.importe) AS total, min(k.vencimiento) AS vence,
                 max(k.created_at) AS creado, to_char(min(k.vencimiento), 'YYYY-MM-DD') AS texto,
                 array_agg(k.id ORDER BY k.id) AS ids, bool_and(k.anulado_en IS NULL) AS vivos,
                 (SELECT l.detalle FROM alq_liquidacion l LIMIT 1) AS detalle,
                 (SELECT t.modulos FROM tenant t LIMIT 1) AS modulos,
                 1.5::float8 AS flotante, 7::int4 AS entero, 'x'::text AS texto_fijo,
                 now()::date - min(k.vencimiento) AS dias
            FROM alq_concepto k`,
      );
      expect(huella(a)).toEqual(huella(b));
    });

    it('los parámetros llegan igual: fechas, decimales, números, textos, arreglos y booleanos', async () => {
      const dia = new Date('2026-03-01T00:00:00.000Z');
      const instante = new Date('2026-03-01T02:30:00.000Z');
      const { pg: a, motor: b } = await porLosDos(
        zona,
        (tx) =>
          tx.$queryRaw<Record<string, unknown>[]>`
          SELECT ${dia}::date AS dia, ${instante}::timestamptz AS instante,
                 ${'2026-03-01'}::date AS dia_texto,
                 ${new Prisma.Decimal('1234567.89')}::numeric AS decimal,
                 ${1234.56}::numeric AS numero, ${42}::int AS entero, ${BigInt('9007199254740993')}::int8 AS grande,
                 ${['2026-01-31', '2026-02-28']}::date[] AS cierres,
                 ${[ids.alqContrato]}::uuid[] AS contratos, ${true}::boolean AS verdad,
                 ${`${ids.tenant}:alq_cobro`}::text AS clave,
                 (SELECT count(*) FROM alq_concepto k WHERE k.vencimiento >= ${dia}) AS desde_dia,
                 (SELECT count(*) FROM alq_concepto k WHERE k.created_at >= ${instante}) AS desde_instante,
                 (SELECT count(*) FROM alq_concepto k WHERE k.tipo = ANY(${['alquiler', 'otro']})) AS por_tipo,
                 hashtext(${ids.tenant} || ':alq_reclamo') AS hash`,
      );
      expect(huella(a)).toEqual(huella(b));
      // Y lo que se mandó es lo que se pidió, no solo lo mismo por los dos lados.
      const fila = a[0]!;
      expect(huella(fila.dia)).toBe('fecha:2026-03-01T00:00:00.000Z');
      expect(huella(fila.instante)).toBe('fecha:2026-03-01T02:30:00.000Z');
      expect(huella(fila.decimal)).toBe('decimal:1234567.89');
      expect(huella(fila.grande)).toBe('bigint:9007199254740993');
    });

    it('una fecha escrita por el adaptador se lee igual por el motor, sin correrse un día', async () => {
      process.env.TZ = zona;
      const vence = new Date('2026-12-31T00:00:00.000Z');
      const id = await conPg.withTenant(async (tx) => {
        const k = await tx.alqConcepto.create({
          data: {
            tenantId: ids.tenant,
            personaId: ids.alqPersona,
            contratoId: ids.alqContrato,
            tipo: 'otro',
            sentido: 'a_cobrar',
            vencimiento: vence,
            importe: new Prisma.Decimal('0.10'),
            descripcion: `conector ${zona}`,
          },
        });
        return k.id;
      }, ctx);
      const leido = await conMotor.withTenant(
        (tx) => tx.alqConcepto.findUniqueOrThrow({ where: { id } }),
        ctx,
      );
      expect(leido.vencimiento.toISOString()).toBe('2026-12-31T00:00:00.000Z');
      expect(leido.importe.toString()).toBe('0.1');
      const enSql = await siembra.$queryRaw<{ d: string }[]>`
        SELECT to_char(vencimiento, 'YYYY-MM-DD') AS d FROM alq_concepto WHERE id = ${id}::uuid`;
      expect(enSql[0]!.d).toBe('2026-12-31');
      await siembra.alqConcepto.delete({ where: { id } });
    });
  });

  it('aunque la sesión de la base esté en otra zona, withTenant escribe y lee los instantes en UTC', async () => {
    // El adaptador manda los instantes sin zona y lee los de la base como UTC:
    // con la sesión en Tokio, sin el `set_config('TimeZone', 'UTC')` de
    // withTenant esto se corre nueve horas. Va por la conexión directa porque
    // PgBouncer no le pasa a la base la zona de la conexión (`options`).
    const directa = new URL(URL_DIRECTA!);
    directa.searchParams.set('options', '-c TimeZone=Asia/Tokyo');
    const tokio = new PrismaService({ url: directa.toString(), conector: 'pg' });
    try {
      const enTokio = await tokio.$queryRaw<
        { z: string }[]
      >`SELECT current_setting('TimeZone') AS z`;
      expect(enTokio[0]!.z).toBe('Asia/Tokyo');
      const db = new TenantPrismaService(tokio, { get: () => undefined } as unknown as ClsService);
      const instante = new Date('2026-03-01T02:30:00.000Z');
      const id = await db.withTenant(async (tx) => {
        const k = await tx.alqConcepto.create({
          data: {
            tenantId: ids.tenant,
            personaId: ids.alqPersona,
            tipo: 'otro',
            sentido: 'a_cobrar',
            vencimiento: new Date('2026-03-01T00:00:00.000Z'),
            importe: 1,
            anuladoEn: instante,
            descripcion: 'zona de la sesión',
          },
        });
        return k.id;
      }, ctx);
      const leido = await db.withTenant(
        (tx) => tx.alqConcepto.findUniqueOrThrow({ where: { id } }),
        ctx,
      );
      expect(leido.anuladoEn?.toISOString()).toBe(instante.toISOString());
      const enLaBase = await siembra.$queryRaw<{ t: string }[]>`
        SELECT to_char(anulado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS t
          FROM alq_concepto WHERE id = ${id}::uuid`;
      expect(enLaBase[0]!.t).toBe('2026-03-01 02:30');
      await siembra.alqConcepto.delete({ where: { id } });
    } finally {
      await tokio.$disconnect();
    }
  });

  it('el candado de Alquileres hace esperar al segundo pedido hasta que el primero termina', async () => {
    const orden: string[] = [];
    let soltar!: () => void;
    const suelto = new Promise<void>((r) => (soltar = r));
    let tomado!: () => void;
    const yaTomado = new Promise<void>((r) => (tomado = r));
    const primero = conPg.withTenant(async (tx) => {
      await tomarCandados(tx, ids.tenant, 'alq_cobro');
      orden.push('primero tomó');
      tomado();
      await suelto;
      orden.push('primero termina');
    }, ctx);
    await yaTomado;
    const segundo = conPg.withTenant(async (tx) => {
      await tomarCandados(tx, ids.tenant, 'alq_cobro');
      orden.push('segundo tomó');
    }, ctx);
    // Medio segundo para que el segundo llegue al candado y espere.
    await new Promise((r) => setTimeout(r, 500));
    expect(orden).toEqual(['primero tomó']);
    soltar();
    await Promise.all([primero, segundo]);
    expect(orden).toEqual(['primero tomó', 'primero termina', 'segundo tomó']);
  });

  it('SELECT … FOR UPDATE de una reserva hace esperar al segundo pedido', async () => {
    const orden: string[] = [];
    let soltar!: () => void;
    const suelto = new Promise<void>((r) => (soltar = r));
    let tomado!: () => void;
    const yaTomado = new Promise<void>((r) => (tomado = r));
    const primero = conPg.withTenant(async (tx) => {
      await bloquearReserva(tx, ids.alqReserva);
      orden.push('primero');
      tomado();
      await suelto;
    }, ctx);
    await yaTomado;
    const segundo = conPg.withTenant(async (tx) => {
      await bloquearReserva(tx, ids.alqReserva);
      orden.push('segundo');
    }, ctx);
    await new Promise((r) => setTimeout(r, 500));
    expect(orden).toEqual(['primero']);
    soltar();
    await Promise.all([primero, segundo]);
    expect(orden).toEqual(['primero', 'segundo']);
  });

  it('un error dentro de la transacción la deshace entera, y la conexión vuelve sana al pool', async () => {
    const descripcion = `se deshace ${Date.now()}`;
    await expect(
      conPg.withTenant(async (tx) => {
        await tx.alqConcepto.create({
          data: {
            tenantId: ids.tenant,
            personaId: ids.alqPersona,
            tipo: 'otro',
            sentido: 'a_cobrar',
            vencimiento: new Date('2026-01-01T00:00:00Z'),
            importe: 1,
            descripcion,
          },
        });
        await tx.$executeRaw`SELECT 1 / 0`;
      }, ctx),
    ).rejects.toThrow();
    const quedo = await siembra.alqConcepto.count({ where: { descripcion } });
    expect(quedo).toBe(0);
    // La siguiente transacción, por la misma conexión o por otra, anda y ve su contexto.
    const visto = await conPg.withTenant(
      (tx) => tx.$queryRaw<{ t: string }[]>`SELECT current_setting('app.tenant_id', true) AS t`,
      ctx,
    );
    expect(visto[0]!.t).toBe(ids.tenant);
  });
});
