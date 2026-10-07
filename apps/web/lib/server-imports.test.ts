import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Una página del servidor no puede USAR un valor que viene de un módulo
 * `'use client'`: Next lo reemplaza por una referencia al cliente. Un
 * componente se puede renderizar, pero una función no se puede llamar y una
 * constante no trae su valor. En desarrollo y en los tests anda; en
 * producción la página entera cae con «Algo salió mal».
 *
 * Pasó el 7/10/2026 con `vistaImpuestos()` en /alquileres/impuestos. Este test
 * recorre todo lo que corre en el servidor bajo `app/` y falla si importa de un
 * módulo cliente algo que no sea un componente (nombre en PascalCase) o un tipo.
 */

const RAIZ = resolve(__dirname, '..');
const APP = join(RAIZ, 'app');
const DEL_SERVIDOR = /^(page|layout|template|not-found|default|route)\.(ts|tsx)$/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : [p];
  });
}

const esCliente = (codigo: string) =>
  /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*['"]use client['"]/.test(codigo);

function resolver(desde: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith('.')) base = resolve(dirname(desde), especificador);
  else if (especificador.startsWith('@/')) base = join(RAIZ, especificador.slice(2));
  else return null; // paquetes: no son de esta app
  for (const c of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

/** Los nombres de valor (no tipos) de cada `import { … } from '…'`. */
function importsConNombre(codigo: string): { desde: string; nombres: string[] }[] {
  const out: { desde: string; nombres: string[] }[] = [];
  for (const m of codigo.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    if (m[1]) continue; // `import type { … }`
    const nombres = m[2]!
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('type '))
      .map((s) => s.split(/\s+as\s+/)[0]!.trim());
    out.push({ desde: m[3]!, nombres });
  }
  return out;
}

const esComponente = (nombre: string) => /^[A-Z][a-z0-9]/.test(nombre);

describe('lo que corre en el servidor no usa valores de módulos cliente', () => {
  const servidor = archivos(APP).filter(
    (p) => DEL_SERVIDOR.test(p.split('/').pop()!) && !esCliente(readFileSync(p, 'utf8')),
  );

  it('hay páginas para revisar', () => {
    expect(servidor.length).toBeGreaterThan(10);
  });

  it('ninguna importa de un módulo «use client» algo que no sea un componente', () => {
    const problemas: string[] = [];
    for (const archivo of servidor) {
      for (const { desde, nombres } of importsConNombre(readFileSync(archivo, 'utf8'))) {
        const destino = resolver(archivo, desde);
        if (!destino || !esCliente(readFileSync(destino, 'utf8'))) continue;
        for (const n of nombres.filter((n) => !esComponente(n)))
          problemas.push(`${relative(RAIZ, archivo)} usa «${n}» de ${relative(RAIZ, destino)}`);
      }
    }
    expect(problemas).toEqual([]);
  });
});
