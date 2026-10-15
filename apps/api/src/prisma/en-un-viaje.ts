import { Prisma } from '@prisma/client';

/**
 * Varias consultas de lectura en UNA sentencia: un solo viaje a la base.
 *
 * Dentro de una transacción las consultas van de a una por la misma conexión,
 * y cada una paga la ida y vuelta entre Render (Oregon) y Supabase (São
 * Paulo), ~150 ms. Cuatro consultas independientes en una sentencia son un
 * viaje en vez de cuatro. Y una sentencia ve UNA sola foto de la base: con
 * READ COMMITTED, cuatro sentencias en la misma transacción pueden ver cada
 * una lo último confirmado en su momento.
 *
 * Cada parte vuelve como `jsonb` y se rearma acá con los tipos de siempre:
 * los importes viajan como texto (exactos, no como número de coma flotante) y
 * vuelven `Prisma.Decimal`; las fechas `date` vuelven `Date` a la medianoche
 * UTC, como las devuelve Prisma. El orden de las filas es el de cada consulta.
 */
export interface Parte {
  sql: Prisma.Sql;
  /** Columnas `numeric`: viajan como texto, vuelven `Prisma.Decimal`. */
  decimales?: string[];
  /** Columnas `date`: vuelven `Date` a la medianoche UTC. */
  fechas?: string[];
}

const NOMBRE = /^[a-z_][a-z0-9_]*$/;
const nombre = (x: string) => {
  // Son constantes del código, nunca algo del pedido; igual, solo identificadores.
  if (!NOMBRE.test(x)) throw new Error(`«${x}» no es un nombre de columna válido.`);
  return x;
};

/**
 * Las partes en una sentencia; para los tests de la consulta (que la responden
 * parte por parte, como lo haría la base), cada sentencia recuerda sus partes.
 */
export const PARTES_DE_LA_SENTENCIA = new WeakMap<Prisma.Sql, Record<string, Parte>>();

export function sqlEnUnViaje(partes: Record<string, Parte>): Prisma.Sql {
  const columnas = Object.entries(partes).map(([clave, p]) => {
    const exactos = p.decimales?.length
      ? Prisma.sql` || jsonb_build_object(${Prisma.raw(
          p.decimales.map((c) => `'${nombre(c)}', x.${nombre(c)}::text`).join(', '),
        )})`
      : Prisma.empty;
    return Prisma.sql`(SELECT coalesce(jsonb_agg(to_jsonb(x)${exactos}), '[]'::jsonb) FROM (${p.sql}) x) AS ${Prisma.raw(nombre(clave))}`;
  });
  const sql = Prisma.sql`SELECT ${Prisma.join(columnas, ',\n       ')}`;
  PARTES_DE_LA_SENTENCIA.set(sql, partes);
  return sql;
}

/** La fila que devuelve `sqlEnUnViaje`, rearmada parte por parte. */
export function filasEnUnViaje<K extends string>(
  partes: Record<K, Parte>,
  fila: Record<string, unknown>,
): Record<K, Record<string, unknown>[]> {
  const salida = {} as Record<K, Record<string, unknown>[]>;
  for (const clave of Object.keys(partes) as K[]) {
    const p = partes[clave];
    const filas = (fila[clave] ?? []) as Record<string, unknown>[];
    salida[clave] = filas.map((f) => {
      const r = { ...f };
      for (const c of p.decimales ?? []) if (r[c] != null) r[c] = new Prisma.Decimal(String(r[c]));
      for (const c of p.fechas ?? [])
        if (r[c] != null) {
          const s = String(r[c]);
          r[c] = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
        }
      return r;
    });
  }
  return salida;
}

/** Corre las partes en un solo viaje y devuelve sus filas, cada una con sus tipos. */
export async function enUnViaje<K extends string>(
  tx: Prisma.TransactionClient,
  partes: Record<K, Parte>,
): Promise<Record<K, Record<string, unknown>[]>> {
  const [fila] = await tx.$queryRaw<Record<string, unknown>[]>(sqlEnUnViaje(partes));
  return filasEnUnViaje(partes, fila ?? {});
}
