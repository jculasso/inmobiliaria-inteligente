import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Toda pantalla que pide datos con alcance tiene que respetar el alcance.
 *
 * El mismo descuido apareció DOS veces seguidas en el reporte de tasaciones:
 * primero la pantalla no tenía el check "Ver todo" y nunca mandaba `verTodo`;
 * después, ya arreglada la pantalla, resultó que su PDF tampoco lo mandaba. En
 * los dos casos el síntoma fue el mismo y tardó semanas en aparecer: un usuario
 * de dirección veía solo lo suyo, o directamente una pantalla en cero.
 *
 * Revisarlo a mano funciona una vez. Esto lo revisa en cada cambio.
 *
 * ── Cómo funciona ──────────────────────────────────────────────────────────
 *
 * 1. Busca en `lib/*-api.ts` las funciones cuyo cuerpo menciona `verTodo`: son
 *    las que hablan con un endpoint que filtra por alcance. La lista se deduce,
 *    no se escribe a mano — una función nueva entra sola.
 * 2. Recorre `app/` y `components/` y marca los archivos que llaman a alguna.
 * 3. Cada uno de esos archivos tiene que mencionar `verTodo`, o estar en
 *    EXCEPCIONES con el motivo escrito.
 *
 * Lo que NO comprueba: que el valor sea el correcto, ni que el check se vea. Eso
 * lo cubren los tests de cada pantalla. Esto solo garantiza que nadie pida datos
 * con alcance sin siquiera nombrarlo.
 */

const RAIZ = resolve(process.cwd());

/**
 * Archivos que llaman a una función con alcance y NO mencionan `verTodo`, a
 * propósito. Cada entrada es una decisión, no un trámite.
 */
const EXCEPCIONES: Record<string, string> = {
  'components/tablero/detalle-drill-modal.tsx':
    'No arma el filtro: lo recibe entero por prop y lo reenvía tal cual. El ' +
    'alcance lo pone quien lo abre (vendedor-totales-table), que sí lo nombra. ' +
    'Agregarle un `verTodo` propio sería darle dos fuentes al mismo dato.',
};

function archivosTsx(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'node_modules' || entrada === '.next') continue;
      salida.push(...archivosTsx(ruta));
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      salida.push(ruta);
    }
  }
  return salida;
}

/** Cuerpo de cada `export async function` de un archivo, por nombre. */
function funcionesDe(fuente: string): Map<string, string> {
  const mapa = new Map<string, string>();
  const re = /export async function (\w+)\s*\([^)]*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente))) {
    let prof = 1;
    let i = re.lastIndex;
    while (i < fuente.length && prof > 0) {
      if (fuente[i] === '{') prof++;
      else if (fuente[i] === '}') prof--;
      i++;
    }
    mapa.set(m[1]!, fuente.slice(re.lastIndex, i));
  }
  return mapa;
}

/** Las funciones del cliente que hablan con un endpoint filtrado por alcance. */
function funcionesConAlcance(): Set<string> {
  const nombres = new Set<string>();
  const libDir = join(RAIZ, 'lib');
  for (const archivo of readdirSync(libDir).filter((f) => f.endsWith('-api.ts'))) {
    const fuente = readFileSync(join(libDir, archivo), 'utf8');
    for (const [nombre, cuerpo] of funcionesDe(fuente)) {
      // `paramsDelFiltro` centraliza el mapeo del Tasador; mencionarlo cuenta.
      if (cuerpo.includes('verTodo') || cuerpo.includes('paramsDelFiltro')) nombres.add(nombre);
    }
  }
  return nombres;
}

describe('las pantallas que piden datos con alcance lo respetan', () => {
  const conAlcance = funcionesConAlcance();

  it('encuentra las funciones con alcance (si no, el resto no prueba nada)', () => {
    // Sin esta guarda, un cambio de forma en los archivos de API dejaría el
    // conjunto vacío y los tests de abajo pasarían por no revisar nada.
    expect(conAlcance.size).toBeGreaterThanOrEqual(10);
    expect(conAlcance.has('listOperaciones')).toBe(true);
    expect(conAlcance.has('generarInformeReporte')).toBe(true);
  });

  it('ningún archivo pide datos con alcance sin nombrar verTodo', () => {
    const infractores: string[] = [];

    for (const dir of ['app', 'components']) {
      for (const ruta of archivosTsx(join(RAIZ, dir))) {
        const fuente = readFileSync(ruta, 'utf8');
        const rel = relative(RAIZ, ruta).replace(/\\/g, '/');

        const usadas = [...conAlcance].filter((fn) =>
          new RegExp(`\\b${fn}\\s*\\(`).test(fuente),
        );
        if (usadas.length === 0) continue;
        if (fuente.includes('verTodo')) continue;
        if (rel in EXCEPCIONES) continue;

        infractores.push(`${rel} — llama a ${usadas.join(', ')}`);
      }
    }

    expect(
      infractores,
      infractores.length
        ? `Estos archivos piden datos filtrados por alcance y nunca mencionan ` +
            `\`verTodo\`, así que van a mostrar SOLO lo del usuario aunque la ` +
            `pantalla ofrezca "Ver todo":\n\n  ${infractores.join('\n  ')}\n\n` +
            `Pasá \`verTodo\` a la llamada, o agregá el archivo a EXCEPCIONES ` +
            `en este test con el motivo escrito.`
        : '',
    ).toEqual([]);
  });

  it('las excepciones siguen apuntando a archivos que llaman con alcance', () => {
    // Una excepción que ya no corresponde a nada es basura que aparenta
    // cobertura: si el archivo se movió, conviene enterarse.
    const muertas = Object.keys(EXCEPCIONES).filter((rel) => {
      let fuente: string;
      try {
        fuente = readFileSync(join(RAIZ, rel), 'utf8');
      } catch {
        return true;
      }
      return ![...conAlcance].some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(fuente));
    });

    expect(
      muertas,
      muertas.length ? `Excepciones que ya no aplican: ${muertas.join(', ')}` : '',
    ).toEqual([]);
  });
});
