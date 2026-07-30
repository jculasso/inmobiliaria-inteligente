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
  const tasacionA = randomUUID();
  const tasacionB = randomUUID();
  const protocoloA = randomUUID();
  const protocoloB = randomUUID();

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
    // Una tasación por tenant, para verificar que el aislamiento también
    // aplica a las tablas del módulo Tasador (no solo al núcleo).
    await client.query(
      `INSERT INTO tasacion
         (id, tenant_id, agente_id, cliente, fecha, direccion, tipo_operacion, tipo_propiedad, superficie_total, updated_at)
       VALUES
         ($1, $3, $5, 'Cliente A', now(), 'Calle Falsa 123', 'venta', 'Casa', 100, now()),
         ($2, $4, $6, 'Cliente B', now(), 'Calle Falsa 456', 'venta', 'Casa', 100, now())`,
      [tasacionA, tasacionB, tenantA, tenantB, userA, userB],
    );
    // Un protocolo por tenant, con una acción cada uno — el módulo Protocolo
    // 5 Semanas tiene que quedar aislado igual que el resto.
    await client.query(
      `INSERT INTO protocolo (id, tenant_id, tasacion_id, agente_id, fecha_inicio, updated_at)
       VALUES ($1, $3, $5, $7, now(), now()),
              ($2, $4, $6, $8, now(), now())`,
      [protocoloA, protocoloB, tenantA, tenantB, tasacionA, tasacionB, userA, userB],
    );
    await client.query(
      `INSERT INTO protocolo_accion (id, protocolo_id, tenant_id, semana, orden, clave, titulo)
       VALUES ($1, $3, $5, 1, 0, 'estudio-titulos', 'Acción A'),
              ($2, $4, $6, 1, 0, 'estudio-titulos', 'Acción B')`,
      [randomUUID(), randomUUID(), protocoloA, protocoloB, tenantA, tenantB],
    );
    // Una credencial de integración por tenant, con ultimos4 distintos para
    // poder afirmar CUÁL se vio y no solo cuántas.
    await client.query(
      `INSERT INTO integracion_credencial (id, tenant_id, proveedor, secreto_enc, ultimos4, updated_at)
       VALUES ($1, $3, 'tokko', 'cifrado-A', 'AAAA', now()),
              ($2, $4, 'tokko', 'cifrado-B', 'BBBB', now())`,
      [randomUUID(), randomUUID(), tenantA, tenantB],
    );
    // Una propiedad espejada de Tokko por tenant.
    await client.query(
      `INSERT INTO propiedad (id, tenant_id, tokko_id, titulo, updated_at)
       VALUES ($1, $3, 111, 'Casa A', now()),
              ($2, $4, 222, 'Casa B', now())`,
      [randomUUID(), randomUUID(), tenantA, tenantB],
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

  it('el aislamiento también aplica al módulo Tasador (tabla tasacion)', async () => {
    await enterTenant(tenantA, userA);
    const propias = await client.query<{ cliente: string }>('SELECT cliente FROM tasacion');
    expect(propias.rows).toHaveLength(1);
    expect(propias.rows[0]?.cliente).toBe('Cliente A');

    const upd = await client.query(
      'UPDATE tasacion SET cliente = $1 WHERE agente_id = $2',
      ['hackeado', userB],
    );
    expect(upd.rowCount).toBe(0);
  });

  it('el aislamiento también aplica al módulo Protocolo (protocolo y sus acciones)', async () => {
    await enterTenant(tenantA, userA);

    const protocolos = await client.query<{ id: string }>('SELECT id FROM protocolo');
    expect(protocolos.rows).toHaveLength(1);
    expect(protocolos.rows[0]?.id).toBe(protocoloA);

    const acciones = await client.query<{ titulo: string }>('SELECT titulo FROM protocolo_accion');
    expect(acciones.rows).toHaveLength(1);
    expect(acciones.rows[0]?.titulo).toBe('Acción A');

    // No se puede tocar la ficha del otro tenant ni por id directo.
    const upd = await client.query('UPDATE protocolo SET estado = $1 WHERE id = $2', [
      'archivada',
      protocoloB,
    ]);
    expect(upd.rowCount).toBe(0);

    const updAccion = await client.query(
      'UPDATE protocolo_accion SET estado = $1 WHERE protocolo_id = $2',
      ['realizada', protocoloB],
    );
    expect(updAccion.rowCount).toBe(0);
  });

  it('no se puede crear un protocolo en el tenant ajeno (WITH CHECK)', async () => {
    await enterTenant(tenantA, userA);
    const blocked = await writeIsBlocked(
      `INSERT INTO protocolo (id, tenant_id, tasacion_id, agente_id, fecha_inicio, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`,
      [randomUUID(), tenantB, tasacionB, userB],
    );
    expect(blocked).toBe(true);
  });

  /**
   * Credenciales de integraciones (la API key de Tokko de cada inmobiliaria).
   *
   * Es la tabla más sensible del sistema: con la clave de otra agencia se le
   * pueden leer y publicar propiedades en su propia cuenta de Tokko. El secreto
   * va cifrado, pero eso protege un backup robado, no una consulta mal acotada
   * — el aislamiento lo tiene que dar RLS.
   */
  it('una inmobiliaria no ve ni toca la credencial de integración de otra', async () => {
    await enterTenant(tenantA, userA);

    const propias = await client.query<{ tenant_id: string; ultimos4: string }>(
      'SELECT tenant_id, ultimos4 FROM integracion_credencial',
    );
    expect(propias.rows).toHaveLength(1);
    expect(propias.rows[0]?.tenant_id).toBe(tenantA);
    expect(propias.rows[0]?.ultimos4).toBe('AAAA');

    // Ni leyendo por proveedor, que es la consulta natural del servicio.
    const porProveedor = await client.query(
      `SELECT secreto_enc FROM integracion_credencial WHERE proveedor = 'tokko'`,
    );
    expect(porProveedor.rows).toHaveLength(1);

    // Ni pisándola con un UPDATE apuntando al tenant ajeno.
    const upd = await client.query(
      'UPDATE integracion_credencial SET secreto_enc = $1 WHERE tenant_id = $2',
      ['robada', tenantB],
    );
    expect(upd.rowCount).toBe(0);

    const del = await client.query('DELETE FROM integracion_credencial WHERE tenant_id = $1', [
      tenantB,
    ]);
    expect(del.rowCount).toBe(0);
  });

  it('una inmobiliaria no ve las propiedades espejadas de otra', async () => {
    await enterTenant(tenantA, userA);

    const propias = await client.query<{ titulo: string }>('SELECT titulo FROM propiedad');
    expect(propias.rows).toHaveLength(1);
    expect(propias.rows[0]?.titulo).toBe('Casa A');

    // Ni por el id de Tokko, que es la consulta natural al espejar.
    const porTokko = await client.query('SELECT titulo FROM propiedad WHERE tokko_id = $1', [222]);
    expect(porTokko.rows).toHaveLength(0);

    const upd = await client.query('UPDATE propiedad SET titulo = $1 WHERE tokko_id = $2', [
      'pisada',
      222,
    ]);
    expect(upd.rowCount).toBe(0);
  });

  it('no se puede cargar una credencial en el tenant ajeno (WITH CHECK)', async () => {
    await enterTenant(tenantA, userA);
    const blocked = await writeIsBlocked(
      `INSERT INTO integracion_credencial (id, tenant_id, proveedor, secreto_enc, ultimos4, updated_at)
       VALUES ($1, $2, 'tokko', 'x', 'XXXX', now())`,
      [randomUUID(), tenantB],
    );
    expect(blocked).toBe(true);
  });
});
