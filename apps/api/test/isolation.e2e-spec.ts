import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

/**
 * Test de aislamiento entre tenants (RLS) — la pieza crítica del núcleo.
 *
 * Reproduce EXACTAMENTE el mecanismo de TenantPrismaService.withTenant:
 * set_config('app.tenant_id') + `SET LOCAL ROLE authenticated`. Todo ocurre
 * dentro de una única transacción que se hace ROLLBACK al final → cero residuo
 * en la base de dev. Se saltea si no hay DIRECT_URL (p. ej. CI sin secret).
 */
const DIRECT_URL = process.env.DIRECT_URL;
const suite = DIRECT_URL ? describe : describe.skip;

suite('Aislamiento entre tenants (RLS)', () => {
  let client: Client;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();

  // Entra al contexto de un tenant como rol `authenticated` (RLS activa).
  async function enterTenant(tenantId: string, userId: string): Promise<void> {
    await client.query('RESET ROLE');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
    await client.query('SET LOCAL ROLE authenticated');
  }

  // Ejecuta una escritura que RLS debe rechazar (WITH CHECK) sin abortar la tx.
  async function writeIsBlocked(sql: string, params: unknown[]): Promise<boolean> {
    await client.query('SAVEPOINT sp');
    try {
      await client.query(sql, params);
      await client.query('RELEASE SAVEPOINT sp');
      return false;
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      return true;
    }
  }

  beforeAll(async () => {
    client = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query('BEGIN');
    // Seed como postgres (BYPASSRLS): 2 tenants con un usuario y un rol cada uno.
    await client.query(
      `INSERT INTO tenant (id, nombre, slug, updated_at)
       VALUES ($1, 'Tenant A', $2, now()),
              ($3, 'Tenant B', $4, now())`,
      [tenantA, `iso-a-${tenantA}`, tenantB, `iso-b-${tenantB}`],
    );
    await client.query(
      `INSERT INTO usuario (id, tenant_id, nombre, email, updated_at)
       VALUES ($1, $3, 'Usuario A', 'a@iso.test', now()),
              ($2, $4, 'Usuario B', 'b@iso.test', now())`,
      [userA, userB, tenantA, tenantB],
    );
    await client.query(
      `INSERT INTO usuario_rol (usuario_id, rol, tenant_id)
       VALUES ($1, 'admin_tenant', $3), ($2, 'admin_tenant', $4)`,
      [userA, userB, tenantA, tenantB],
    );
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  });

  it('un tenant solo ve sus propias filas (usuario y tenant)', async () => {
    await enterTenant(tenantA, userA);
    const usuarios = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM usuario');
    expect(usuarios.rows[0]?.n).toBe(1);
    const tenants = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM tenant');
    expect(tenants.rows[0]?.n).toBe(1);
    const bVisible = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM usuario WHERE id = $1',
      [userB],
    );
    expect(bVisible.rows[0]?.n).toBe(0);
  });

  it('sin contexto de tenant no se ve ninguna fila (deny por defecto)', async () => {
    await client.query('RESET ROLE');
    await client.query(`SELECT set_config('app.tenant_id', '', true)`);
    await client.query('SET LOCAL ROLE authenticated');
    const r = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM usuario');
    expect(r.rows[0]?.n).toBe(0);
  });

  it('no se puede INSERTAR una fila de otro tenant (WITH CHECK)', async () => {
    await enterTenant(tenantA, userA);
    const blocked = await writeIsBlocked(
      `INSERT INTO usuario (id, tenant_id, nombre, email, updated_at)
       VALUES ($1, $2, 'Intruso', 'intruso@iso.test', now())`,
      [randomUUID(), tenantB],
    );
    expect(blocked).toBe(true);
  });

  it('UPDATE/DELETE no afectan filas de otro tenant', async () => {
    await enterTenant(tenantA, userA);
    const upd = await client.query('UPDATE usuario SET nombre = $1 WHERE id = $2', ['hackeado', userB]);
    expect(upd.rowCount).toBe(0);
    const del = await client.query('DELETE FROM usuario WHERE id = $1', [userB]);
    expect(del.rowCount).toBe(0);
  });

  it('el aislamiento es simétrico (tenant B solo ve lo suyo)', async () => {
    await enterTenant(tenantB, userB);
    const r = await client.query<{ email: string }>('SELECT email FROM usuario');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.email).toBe('b@iso.test');
  });
});
