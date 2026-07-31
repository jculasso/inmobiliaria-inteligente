import { inflateSync } from 'node:zlib';

/**
 * Devuelve el texto legible de un PDF, para poder afirmar en un test QUÉ dice
 * un informe y no solo que se generó sin romperse.
 *
 * Hace falta porque el texto no viaja como texto: react-pdf incrusta la fuente
 * como subconjunto y escribe **identificadores de glifo** (`<00010002> Tj`).
 * Para volver a los caracteres hay que leer el `ToUnicode` de cada fuente, un
 * CMap con líneas `<0001><004a>` (glifo 1 → "J").
 *
 * El detalle incómodo: cada peso de la fuente —Regular, Bold, ExtraBold— es un
 * subconjunto distinto, con SUS propios ids. El glifo 1 es "J" en uno y otra
 * letra en otro. Asociar cada texto con la fuente que tenía activa exigiría
 * seguir los `/F1 Tf` del content stream, que es un parser entero.
 *
 * Como acá solo se necesita preguntar "¿el PDF dice esta frase?", se hace algo
 * más barato y suficiente: cada texto se decodifica con TODOS los CMaps y se
 * devuelven todas las lecturas juntas. La correcta está entre ellas; las demás
 * son ruido que ninguna frase real va a coincidir por casualidad.
 *
 * Por eso sirve para `toContain` y NO para comparar el texto completo.
 */
export function textoDePdf(buffer: Buffer): string {
  const streams = inflarStreams(buffer);
  const cmaps = streams.map(leerCMap).filter((m): m is Map<number, string> => m !== null);
  if (cmaps.length === 0) return '';

  // Cada operación de dibujo se toma ENTERA: un `[<0001> 20 <0002>] TJ` trae
  // varios grupos de glifos que forman UNA palabra.
  const operaciones: number[][] = [];
  for (const s of streams) {
    for (const op of s.matchAll(/\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
      const cuerpo = op[1] ?? op[2] ?? '';
      const glifos = [...cuerpo.matchAll(/<([0-9a-fA-F]+)>/g)].flatMap((h) => glifosDe(h[1]!));
      if (glifos.length > 0) operaciones.push(glifos);
    }
  }

  // Una lectura COMPLETA por fuente, no una por operación: si se mezclaran las
  // lecturas de todas las fuentes operación por operación, dos palabras
  // seguidas del mismo texto dejarían de quedar juntas y ninguna frase se
  // podría buscar.
  const lecturas = cmaps.map((cmap) =>
    operaciones
      .map((glifos) => {
        const texto = glifos.map((g) => cmap.get(g) ?? '').join('');
        // Con la fuente equivocada la lectura sale casi vacía.
        return texto.replace(/\s/g, '').length >= glifos.length / 2 ? texto : '';
      })
      .filter(Boolean)
      .join(' '),
  );

  // Los saltos de línea del PDF llegan como operaciones sueltas; normalizar los
  // espacios evita que una frase partida en dos renglones deje de encontrarse.
  return lecturas.join('\n').replace(/[ \t]+/g, ' ');
}

/** Los streams del PDF, descomprimidos. Útil para mirar colores y trazados. */
export function streamsDePdf(buffer: Buffer): string[] {
  return inflarStreams(buffer);
}

function inflarStreams(buffer: Buffer): string[] {
  const bin = buffer.toString('binary');
  const out: string[] = [];
  for (const m of bin.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      out.push(inflateSync(Buffer.from(m[1]!, 'binary')).toString('binary'));
    } catch {
      out.push(m[1]!); // sin comprimir
    }
  }
  return out;
}

/** Lee el mapa glifo → carácter de un stream `ToUnicode`, o null si no lo es. */
function leerCMap(stream: string): Map<number, string> | null {
  if (!stream.includes('beginbfchar') && !stream.includes('beginbfrange')) return null;
  const mapa = new Map<number, string>();

  for (const bloque of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const par of bloque[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      mapa.set(parseInt(par[1]!, 16), aTexto(par[2]!));
    }
  }
  for (const bloque of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const r of bloque[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const desde = parseInt(r[1]!, 16);
      const hasta = parseInt(r[2]!, 16);
      const base = parseInt(r[3]!, 16);
      for (let i = 0; i <= hasta - desde && i < 512; i++) {
        mapa.set(desde + i, String.fromCodePoint(base + i));
      }
    }
  }
  return mapa.size > 0 ? mapa : null;
}

/** Los ids de glifo van de a 2 bytes. */
function glifosDe(hex: string): number[] {
  if (hex.length % 4 !== 0) return [];
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 4) out.push(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

/** Un destino del CMap puede traer varios code points de 2 bytes. */
function aTexto(hex: string): string {
  let s = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const cp = parseInt(hex.slice(i, i + 4), 16);
    if (cp > 0) s += String.fromCodePoint(cp);
  }
  return s;
}

/**
 * Las familias tipográficas con las que el PDF realmente DIBUJA texto, sin el
 * prefijo aleatorio del subconjunto ("VFSAUO+Montserrat-Bold" → "Montserrat-Bold").
 *
 * Sirve para verificar que un informe de marca no arrastre una segunda
 * tipografía: react-pdf incrusta Helvetica por CADA carácter que no encuentre
 * en la familia registrada. Pasó con el ✓ de la tira de semanas —Montserrat no
 * lo tiene— y el PDF terminaba con Helvetica adentro por una sola tilde.
 *
 * Mira lo DIBUJADO y no lo declarado, que no es lo mismo: react-pdf emite un
 * `/F1 Tf` seleccionando Helvetica incluso para un texto vacío, y esa fuente
 * queda declarada en el archivo sin que se vea un solo carácter. Contarla sería
 * denunciar un problema que no existe.
 */
export function fuentesUsadasEnPdf(buffer: Buffer): string[] {
  const bin = buffer.toString('latin1');

  // /F4 → 11 0 R → "/BaseFont /DHWSEN+Montserrat-Regular"
  const objetos = new Map<string, string>();
  for (const o of bin.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) {
    const base = o[2]!.match(/\/BaseFont\s*\/([A-Za-z0-9+\-,_]+)/);
    if (base) objetos.set(o[1]!, base[1]!.replace(/^[A-Z]{6}\+/, ''));
  }
  const recursos = new Map<string, string>();
  for (const mapa of bin.matchAll(/\/Font\s*<<([^>]*)>>/g)) {
    for (const r of mapa[1]!.matchAll(/\/(F\d+)\s+(\d+) 0 R/g)) {
      const familia = objetos.get(r[2]!);
      if (familia) recursos.set(r[1]!, familia);
    }
  }

  const usadas = new Set<string>();
  for (const s of inflarStreams(buffer)) {
    let actual: string | null = null;
    for (const op of s.matchAll(/\/(F\d+) [\d.]+ Tf|\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
      if (op[1]) {
        actual = recursos.get(op[1]) ?? null;
        continue;
      }
      const cuerpo = op[2] ?? op[3] ?? '';
      // Un `Tj` sin glifos no dibuja nada: no cuenta como uso.
      if (actual && /<[0-9a-fA-F]+>/.test(cuerpo)) usadas.add(actual);
    }
  }
  return [...usadas].sort();
}
