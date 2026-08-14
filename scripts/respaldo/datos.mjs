import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * Copia de los datos de producción a archivos locales.
 *
 * Por qué así y no con `pg_dump`: esta máquina no tiene las herramientas
 * cliente de Postgres 17 ni Homebrew para instalarlas. Y no hace falta para
 * tener un respaldo completo: el ESQUEMA ya está versionado en el repositorio
 * —las 22 migraciones lo reconstruyen desde cero— así que lo único que no está
 * en ningún lado son los datos, y eso es lo que se copia acá.
 *
 * Solo LEE. No escribe una sola fila en la base.
 */

const RAIZ = '/Users/javierculasso/Documents/Claude/Projects/Inmobiliaria-Inteligente';
for (const l of readFileSync(RAIZ + '/.env', 'utf8').split('\n')) {
  const i = l.indexOf('=');
  if (l.trim().startsWith('#') || i < 0) continue;
  const k = l.slice(0, i).trim();
  let v = l.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const CUANDO = process.env.CUANDO ?? 'sin-fecha';
const DESTINO = `${process.env.HOME}/Respaldos-Inmobiliaria/${CUANDO}`;
mkdirSync(DESTINO, { recursive: true });

const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

/** JSON no sabe de BigInt ni de Decimal: se guardan como texto, sin perder precisión. */
function serializable(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return { __bytes__: v.toString('base64') };
  if (v && typeof v === 'object' && typeof v.toFixed === 'function') return v.toFixed();
  return v;
}

const tablas = await db.$queryRawUnsafe(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
);

const manifiesto = { cuando: CUANDO, tablas: {}, total: 0 };

for (const { tablename } of tablas) {
  const filas = await db.$queryRawUnsafe(`SELECT * FROM "${tablename}"`);
  const json = JSON.stringify(filas, (_, v) => serializable(v), 1);
  writeFileSync(`${DESTINO}/${tablename}.json`, json);
  manifiesto.tablas[tablename] = {
    filas: filas.length,
    // La huella permite comprobar más adelante que el archivo no se corrompió.
    huella: createHash('sha256').update(json).digest('hex').slice(0, 16),
  };
  manifiesto.total += filas.length;
  console.log(`  ${tablename.padEnd(28)} ${String(filas.length).padStart(6)} filas`);
}

// El estado de las migraciones: sin esto no se sabe contra qué esquema restaurar.
const migraciones = await db.$queryRawUnsafe(
  `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name`,
);
manifiesto.migraciones = migraciones.map((m) => ({
  nombre: m.migration_name,
  aplicada: m.finished_at ? m.finished_at.toISOString() : null,
  revertida: m.rolled_back_at ? m.rolled_back_at.toISOString() : null,
}));
manifiesto.ultimaMigracion = manifiesto.migraciones.filter((m) => m.aplicada).pop()?.nombre ?? null;

writeFileSync(`${DESTINO}/_manifiesto.json`, JSON.stringify(manifiesto, null, 2));
console.log(`\n  ${Object.keys(manifiesto.tablas).length} tablas · ${manifiesto.total} filas`);
console.log(`  última migración aplicada: ${manifiesto.ultimaMigracion}`);
console.log(`  ${DESTINO}`);

await db.$disconnect();
