import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://u:p@host:6543/db',
  DIRECT_URL: 'postgresql://u:p@host:5432/db',
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('validateEnv', () => {
  it('acepta una config válida y aplica defaults', () => {
    const env = validateEnv({ ...base });
    expect(env.API_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('coacciona API_PORT a número', () => {
    const env = validateEnv({ ...base, API_PORT: '4000' });
    expect(env.API_PORT).toBe(4000);
  });

  it('falla si falta una variable requerida', () => {
    const { SUPABASE_URL: _omit, ...incomplete } = base;
    expect(() => validateEnv(incomplete)).toThrow(/Variables de entorno inválidas/);
  });

  it('falla si SUPABASE_URL no es una URL', () => {
    expect(() => validateEnv({ ...base, SUPABASE_URL: 'no-es-url' })).toThrow();
  });
});
