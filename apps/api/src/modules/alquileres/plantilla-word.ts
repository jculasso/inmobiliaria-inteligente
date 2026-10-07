import Docxtemplater from 'docxtemplater';
import InspectModule from 'docxtemplater/js/inspect-module.js';
import PizZip from 'pizzip';
import { MARCADORES_PLANTILLA, PLANTILLA_MAX_BYTES, type MarcadorPlantilla } from '@vacker/types';

/**
 * Las plantillas de contrato en Word (pedido de Javier, 7/10/2026): la
 * inmobiliaria sube su .docx con marcadores `{así}` y de cada contrato se
 * descarga el Word completo.
 *
 * Lo hace `docxtemplater`, que entiende el Word por dentro (un marcador que
 * Word partió en varios pedazos al corregir la ortografía sigue siendo uno).
 * La sintaxis es la suya, con llaves simples:
 *
 * - `{contrato.codigo}`: un dato.
 * - `{#deposito}…{/deposito}`: aparece solo si hay depósito; `{^deposito}…`,
 *   solo si no hay.
 * - `{#tramos}…{/tramos}`: se repite una vez por tramo; adentro, `{desde}`.
 *
 * Los nombres con punto se resuelven con un intérprete propio de diez
 * líneas (`resolver`), sin traer `angular-expressions`: no hace falta más que
 * leer un camino.
 */

/** Lo que llega de Multer. */
export interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/**
 * El valor de `a.b.c` en un alcance. Primero la clave tal cual —los datos del
 * contrato usan claves con punto, como `contrato.codigo`—, después el camino
 * objeto por objeto. Si no está, `undefined`: docxtemplater lo busca entonces
 * en el alcance de afuera (de adentro de `{#tramos}` hacia el contrato).
 */
export function resolver(alcance: unknown, ruta: string): unknown {
  if (ruta === '.') return alcance;
  if (alcance == null || typeof alcance !== 'object' || Array.isArray(alcance)) return undefined;
  // `Object.hasOwn`: «{constructor}» no tiene que imprimir el código de una función.
  if (Object.hasOwn(alcance, ruta)) return (alcance as Record<string, unknown>)[ruta];
  let actual: unknown = alcance;
  for (const parte of ruta.split('.')) {
    if (
      actual == null ||
      typeof actual !== 'object' ||
      Array.isArray(actual) ||
      !Object.hasOwn(actual, parte)
    )
      return undefined;
    actual = (actual as Record<string, unknown>)[parte];
  }
  return actual;
}

const OPCIONES = {
  // Los errores se traducen y se devuelven; que no ensucien el log.
  errorLogging: false,
  // Un `{#tramos}` solo en su párrafo repite el párrafo entero, sin dejar
  // líneas en blanco donde estaban los marcadores.
  paragraphLoop: true,
  // Un salto de línea en un dato se ve como salto de línea en el Word.
  linebreaks: true,
  parser: (tag: string) => {
    const ruta = tag.trim();
    return { get: (alcance: unknown) => resolver(alcance, ruta) };
  },
  // Un dato opcional que falta (la fecha de firma sin cargar) queda vacío, no
  // «undefined». Los nombres desconocidos no llegan hasta acá: se rechazan al
  // subir la plantilla.
  nullGetter: () => '',
};

/** Abre el .docx, o dice en castellano por qué no es uno. */
function abrir(buffer: Buffer): { zip: PizZip } | { problema: string } {
  if (buffer.subarray(0, 4).toString('latin1') !== 'PK\x03\x04')
    return { problema: 'El archivo no es un Word (.docx). Abrilo en Word y guardalo como .docx.' };
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch {
    return { problema: 'El archivo está dañado: no se pudo abrir como Word.' };
  }
  if (!zip.file('word/document.xml'))
    return { problema: 'El archivo no es un documento de Word (.docx).' };
  return { zip };
}

/** Completa la plantilla con los datos del contrato y devuelve el .docx. */
export function completarPlantillaWord(buffer: Buffer, datos: Record<string, unknown>): Buffer {
  const abierto = abrir(buffer);
  if ('problema' in abierto) throw new Error(abierto.problema);
  const doc = new Docxtemplater(abierto.zip, OPCIONES);
  doc.render(datos);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// --- Validación al subir -------------------------------------------------------------

interface ErrorDocx {
  properties?: {
    id?: string;
    xtag?: string;
    context?: string;
    tag?: string;
    openingtag?: string;
    closingtag?: string;
    errors?: ErrorDocx[];
    pair?: { left: string };
    lastPair?: { left: string };
  };
}

/** Un error de docxtemplater, en castellano y nombrando el marcador. */
function traducir(e: ErrorDocx): string {
  const p = e.properties ?? {};
  const cerca = (p.context ?? p.xtag ?? '').trim();
  switch (p.id) {
    case 'unopened_tag':
      return `Hay una llave «}» que cierra sin haber abierto, cerca de «${cerca}».`;
    case 'unclosed_tag':
      return `Falta cerrar la llave en «${cerca}»: cada marcador termina con «}».`;
    case 'duplicate_open_tag':
    case 'duplicate_close_tag':
      return `Hay llaves de más en «${cerca}»: los marcadores van con una sola llave, así: {contrato.codigo}.`;
    case 'unclosed_loop':
      return `«{#${p.xtag}}» se abre y nunca se cierra: falta «{/${p.xtag}}».`;
    case 'unopened_loop':
      return `«{/${p.xtag}}» cierra algo que no se abrió: falta «{#${p.xtag}}» antes.`;
    case 'closing_tag_does_not_match_opening_tag':
      return `«{#${p.openingtag}}» se cierra con «{/${p.closingtag}}»: tiene que cerrarse con «{/${p.openingtag}}».`;
    case 'unbalanced_loop_tags':
      return `«{#${p.lastPair?.left}}» y «{#${p.pair?.left}}» se cruzan (por ejemplo, en celdas distintas de una tabla): cerrá una antes de abrir la otra.`;
    case 'loop_position_invalid':
      return `«{#${p.tag ?? p.xtag}}» está en un lugar que rompería el documento (por ejemplo, abre en una celda y cierra fuera de la tabla).`;
    case 'raw_xml_tag_should_be_only_text_in_paragraph':
      return `«{@${p.xtag}}» no se usa en estas plantillas: escribí {${p.xtag}}.`;
    default:
      return cerca
        ? `Hay un marcador mal escrito cerca de «${cerca}».`
        : 'Hay un marcador mal escrito en la plantilla.';
  }
}

interface Parte {
  type: string;
  value: string;
  module?: string;
  inverted?: boolean;
  subparsed?: Parte[];
}

const POR_NOMBRE = new Map(MARCADORES_PLANTILLA.map((m) => [m.nombre, m]));

/** Lo que se puede nombrar en un nivel: los campos de la lista o la condición que lo abrió. */
type Nivel = { campos: Set<string>; abierto?: true };

/** La distancia de edición entre dos palabras: para sugerir «¿quisiste decir…?». */
function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0]!;
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j]!;
      fila[j] = Math.min(
        fila[j]! + 1,
        fila[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = arriba;
    }
  }
  return fila[b.length]!;
}

function sugerencia(nombre: string, candidatos: Iterable<string>): string {
  let mejor: string | null = null;
  let menor = Infinity;
  for (const c of candidatos) {
    const d = distancia(nombre.toLowerCase(), c.toLowerCase());
    if (d < menor) [mejor, menor] = [c, d];
  }
  return mejor && menor <= Math.max(2, Math.floor(nombre.length / 4))
    ? ` ¿Quisiste decir {${mejor}}?`
    : '';
}

/** Los nombres de texto que se pueden usar desde cualquier lugar. */
const TEXTOS = new Set(MARCADORES_PLANTILLA.filter((m) => m.tipo === 'texto').map((m) => m.nombre));

function conocidoEn(nombre: string, niveles: Nivel[]): boolean {
  return TEXTOS.has(nombre) || niveles.some((n) => n.abierto || n.campos.has(nombre));
}

/** Por qué un marcador que existe no se puede usar como dato suelto. */
function malUsado(m: MarcadorPlantilla): string {
  const textos = MARCADORES_PLANTILLA.filter(
    (t) => t.tipo === 'texto' && t.nombre.startsWith(`${m.nombre}.`),
  ).map((t) => `{${t.nombre}}`);
  const como = `{#${m.nombre}}…{/${m.nombre}}`;
  return m.tipo === 'lista'
    ? `«{${m.nombre}}» es una lista: se usa como ${como}${textos.length ? `, o ${textos.join(' / ')} para todos juntos` : ''}.`
    : `«{${m.nombre}}» es una condición: se usa como ${como}${textos.length ? `; el dato es ${textos.join(' / ')}` : ''}.`;
}

/** Recorre los marcadores con el alcance de cada uno: adentro de una lista valen sus campos. */
function revisar(partes: Parte[], niveles: Nivel[], problemas: Set<string>): void {
  for (const parte of partes) {
    if (parte.type !== 'placeholder') continue;
    const nombre = parte.value.trim();
    if (parte.module === 'rawxml') {
      problemas.add(`«{@${nombre}}» no se usa en estas plantillas: escribí {${nombre}}.`);
      continue;
    }
    if (!nombre) {
      problemas.add('Hay unas llaves vacías «{}»: adentro va el nombre de un dato.');
      continue;
    }
    const marcador = POR_NOMBRE.get(nombre);
    if (parte.module === 'loop') {
      let nivel: Nivel;
      if (marcador && marcador.tipo !== 'texto') {
        nivel = { campos: new Set((marcador.campos ?? []).map((c) => c.nombre)) };
      } else if (conocidoEn(nombre, niveles)) {
        // Una condición sobre un dato de texto: aparece si el dato no está vacío.
        nivel = { campos: new Set() };
      } else {
        problemas.add(desconocido(nombre, niveles));
        // Lo de adentro no se revisa contra una sección que no existe: sería
        // repetir el mismo error por cada campo.
        nivel = { campos: new Set(), abierto: true };
      }
      revisar(parte.subparsed ?? [], [...niveles, nivel], problemas);
      continue;
    }
    if (conocidoEn(nombre, niveles)) continue;
    if (marcador) problemas.add(malUsado(marcador));
    else problemas.add(desconocido(nombre, niveles));
  }
}

function desconocido(nombre: string, niveles: Nivel[]): string {
  const listas = MARCADORES_PLANTILLA.filter((m) => m.campos?.some((c) => c.nombre === nombre));
  if (listas.length)
    return `«{${nombre}}» solo se puede usar adentro de ${listas
      .map((m) => `{#${m.nombre}}…{/${m.nombre}}`)
      .join(', ')}.`;
  const candidatos = [
    ...MARCADORES_PLANTILLA.map((m) => m.nombre),
    ...niveles.flatMap((n) => [...n.campos]),
  ];
  return `«{${nombre}}» no es un marcador conocido.${sugerencia(nombre, candidatos)}`;
}

/** Cuántos problemas se listan como mucho: más que eso, mejor revisar el Word entero. */
const MAX_PROBLEMAS = 20;

/**
 * Lo que está mal en un Word que se quiere subir como plantilla, en
 * castellano. Vacío si se puede usar.
 */
export function problemasDePlantilla(archivo: {
  buffer: Buffer;
  originalname: string;
  size: number;
}): string[] {
  if (!/\.docx$/i.test(archivo.originalname))
    return [
      /\.doc$/i.test(archivo.originalname)
        ? 'Los .doc viejos no sirven: abrilo en Word y guardalo como .docx.'
        : 'La plantilla tiene que ser un archivo de Word (.docx).',
    ];
  if (archivo.size > PLANTILLA_MAX_BYTES) return ['La plantilla pesa más de 5 MB.'];
  const abierto = abrir(archivo.buffer);
  if ('problema' in abierto) return [abierto.problema];

  const inspeccion = new InspectModule();
  try {
    new Docxtemplater(abierto.zip, { ...OPCIONES, modules: [inspeccion] });
  } catch (e) {
    const err = e as ErrorDocx;
    const errores = err.properties?.id === 'multi_error' ? (err.properties.errors ?? []) : [err];
    // Las llaves dobles del editor anterior, {{así}}: docxtemplater las ve
    // como dos errores con un pedazo cada uno. Se nombran enteras, una vez.
    const dobles = [...textoDelXml(abierto.zip).matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map(
      ([todo, nombre]) =>
        `«${todo}» tiene llaves dobles: en Word los marcadores van con una sola, así: {${nombre}}.`,
    );
    const resto = errores.filter(
      (x) =>
        !dobles.length ||
        (x.properties?.id !== 'duplicate_open_tag' && x.properties?.id !== 'duplicate_close_tag'),
    );
    return [...new Set([...dobles, ...resto.map(traducir)])].slice(0, MAX_PROBLEMAS);
  }
  const problemas = new Set<string>();
  revisar(inspeccion.getAllStructuredTags() as Parte[], [], problemas);
  return [...problemas].slice(0, MAX_PROBLEMAS);
}

/** El texto de un .docx, un párrafo por línea: para que los tests lean lo que dice. */
export function textoDeDocx(buffer: Buffer): string {
  return textoDelXml(new PizZip(buffer));
}

function textoDelXml(zip: PizZip): string {
  return zip
    .file('word/document.xml')!
    .asText()
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
