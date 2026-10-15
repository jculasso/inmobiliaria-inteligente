import { describe, expect, it } from 'vitest';
import {
  MAX_CONEXIONES_POR_DEFECTO,
  conectorDelEntorno,
  configDelPool,
  opcionesDelCliente,
} from './conexion';

// Con la forma de la URL de producción, inventada: el pooler de Supabase en
// modo transaction (6543) y `pgbouncer=true`, que solo entiende el motor.
const POOLER =
  'postgresql://postgres.abc:cla%40ve@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

describe('conexion: del DATABASE_URL al pool de node-postgres', () => {
  it('la misma DATABASE_URL de producción sirve tal cual: se le sacan los parámetros del motor', () => {
    const c = configDelPool(POOLER, {});
    const url = new URL(c.connectionString!);
    expect(url.searchParams.has('pgbouncer')).toBe(false);
    expect(url.port).toBe('6543');
    // La contraseña sigue codificada igual.
    expect(url.password).toBe('cla%40ve');
    expect(c.max).toBe(MAX_CONEXIONES_POR_DEFECTO);
    expect(c.connectionTimeoutMillis).toBe(10_000);
  });

  it('a una base remota va cifrado, como el sslmode=prefer del motor; a una local, no', () => {
    expect(configDelPool(POOLER, {}).ssl).toEqual({ rejectUnauthorized: false });
    expect(configDelPool(`${POOLER}&sslmode=require`, {}).ssl).toEqual({
      rejectUnauthorized: false,
    });
    expect(
      new URL(configDelPool(`${POOLER}&sslmode=require`, {}).connectionString!).searchParams.has(
        'sslmode',
      ),
    ).toBe(false);
    expect(configDelPool('postgresql://u:p@127.0.0.1:5432/x', {}).ssl).toBe(false);
    expect(configDelPool(`${POOLER}&sslmode=disable`, {}).ssl).toBe(false);
  });

  it('el tamaño del pool: DATABASE_POOL_MAX, si no el connection_limit de la URL, si no el de siempre', () => {
    expect(configDelPool(`${POOLER}&connection_limit=3`, {}).max).toBe(3);
    expect(configDelPool(`${POOLER}&connection_limit=3`, { DATABASE_POOL_MAX: '7' }).max).toBe(7);
    expect(configDelPool(POOLER, { DATABASE_POOL_MAX: 'muchas' }).max).toBe(
      MAX_CONEXIONES_POR_DEFECTO,
    );
    expect(configDelPool(`${POOLER}&pool_timeout=20`, {}).connectionTimeoutMillis).toBe(20_000);
  });

  it('DATABASE_CONECTOR=motor vuelve al motor de Prisma; cualquier otra cosa es el adaptador', () => {
    expect(conectorDelEntorno({})).toBe('pg');
    expect(conectorDelEntorno({ DATABASE_CONECTOR: 'Motor ' })).toBe('motor');
    expect(conectorDelEntorno({ DATABASE_CONECTOR: 'pg' })).toBe('pg');
    expect(opcionesDelCliente(POOLER, 'motor')).toEqual({ datasourceUrl: POOLER, log: undefined });
    expect(opcionesDelCliente(POOLER, 'pg').adapter).toBeDefined();
    expect(() => opcionesDelCliente(undefined, 'pg')).toThrow(/DATABASE_URL/);
  });
});
