import { readFileSync } from 'node:fs';

/**
 * Mide qué hay en Supabase Storage: las fotos de las tasaciones y los logos NO
 * están en la base, están acá. Una copia de la base sola dejaría filas
 * apuntando a imágenes que ya no existirían.
 *
 * Lista y DESCARGA. No borra ni modifica nada.
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

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cab = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const buckets = await fetch(`${URL_BASE}/storage/v1/bucket`, { headers: cab }).then((r) => r.json());
if (!Array.isArray(buckets)) {
  console.log('  no se pudo listar:', JSON.stringify(buckets).slice(0, 200));
  process.exit(0);
}

/** Recorre un bucket entero, entrando en cada carpeta. */
async function recorrer(bucket, prefijo = '', profundidad = 0) {
  if (profundidad > 4) return [];
  const r = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: cab,
    body: JSON.stringify({ prefix: prefijo, limit: 1000, offset: 0 }),
  }).then((x) => x.json());
  if (!Array.isArray(r)) return [];
  const salida = [];
  for (const o of r) {
    const ruta = prefijo ? `${prefijo}/${o.name}` : o.name;
    // Una "carpeta" en Storage es un objeto sin metadata.
    if (o.id === null) salida.push(...(await recorrer(bucket, ruta, profundidad + 1)));
    else salida.push({ ruta, bytes: o.metadata?.size ?? 0 });
  }
  return salida;
}

const { writeFileSync, mkdirSync } = await import('node:fs');
const { dirname } = await import('node:path');
const DESTINO = `${process.env.HOME}/Respaldos-Inmobiliaria/${process.env.CUANDO}/storage`;

let totalBytes = 0;
let totalArchivos = 0;
let fallados = 0;
for (const b of buckets) {
  const archivos = await recorrer(b.name);
  let bajados = 0;
  for (const a of archivos) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/${b.name}/${a.ruta}`, { headers: cab });
    if (!r.ok) { fallados++; console.log(`    ✗ ${b.name}/${a.ruta} → ${r.status}`); continue; }
    const destino = `${DESTINO}/${b.name}/${a.ruta}`;
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    bajados++;
  }
  const bytes = archivos.reduce((s, a) => s + a.bytes, 0);
  totalBytes += bytes;
  totalArchivos += bajados;
  console.log(
    `  ${b.name.padEnd(22)} ${String(bajados).padStart(5)}/${archivos.length} archivos · ${(bytes / 1024 / 1024).toFixed(1)} MB · ${b.public ? 'público' : 'privado'}`,
  );
}
console.log(`\n  ${totalArchivos} archivos bajados · ${(totalBytes / 1024 / 1024).toFixed(1)} MB · ${fallados} fallaron`);
console.log(`  ${DESTINO}`);
