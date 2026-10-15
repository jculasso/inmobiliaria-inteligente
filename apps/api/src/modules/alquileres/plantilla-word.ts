import { inflateRawSync } from 'node:zlib';
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

// --- Bomba de descompresión ------------------------------------------------------------
//
// Un .docx es un zip, y pizzip descomprime cada archivo de adentro entero, sin
// tope, cuando docxtemplater lo pide. Un zip de 5 MB bien armado se infla a
// gigas: con una sola subida se llenaba la memoria de la API —una instancia,
// todas las inmobiliarias— (revisión de seguridad del 15/10/2026).
//
// Por eso, antes de pizzip, se recorre el directorio del zip a mano:
//
// 1. Lo que cada archivo DICE que pesa descomprimido: ninguno más de 10 MB y
//    entre todos no más de 20 MB. Un contrato real de Word, con logo y
//    firmas escaneadas, anda por 1 MB.
// 2. Lo que de verdad pesa: cada archivo comprimido se infla con
//    `maxOutputLength` igual a lo que declaró. El tamaño declarado lo escribe
//    quien arma el zip, así que no alcanza con creerle: si miente, el inflado
//    corta en el tope y el archivo se rechaza, en lugar de que lo descubra
//    pizzip después de inflarlo entero.

/** Lo más que puede pesar descomprimido un archivo de adentro del Word. */
export const DOCX_MAX_ENTRADA = 10 * 1024 * 1024;
/** Lo más que puede pesar descomprimido el Word entero. */
export const DOCX_MAX_TOTAL = 20 * 1024 * 1024;
/** Cuántos archivos puede tener adentro: un Word normal trae una docena o dos. */
const DOCX_MAX_ARCHIVOS = 2_000;

export const WORD_DEMASIADO_GRANDE =
  'El Word es demasiado grande o está dañado: guardalo de nuevo desde Word y volvé a subirlo.';

const FIRMA_FIN_DIRECTORIO = 0x06054b50;
const FIRMA_DIRECTORIO = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;

/** ¿El zip respeta los topes, declarados y reales? `false` ante cualquier cosa rara. */
function tamaniosRazonables(buf: Buffer): boolean {
  // El fin del directorio central: 22 bytes, más un comentario de hasta 64 KB.
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--)
    if (buf.readUInt32LE(i) === FIRMA_FIN_DIRECTORIO) {
      fin = i;
      break;
    }
  if (fin < 0) return false;
  const cantidad = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  // ZIP64 (más de 65.535 archivos o 4 GB): ningún Word de verdad lo necesita.
  if (cantidad === 0xffff || p === 0xffffffff || cantidad > DOCX_MAX_ARCHIVOS) return false;
  let total = 0;
  for (let n = 0; n < cantidad; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== FIRMA_DIRECTORIO) return false;
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const declarado = buf.readUInt32LE(p + 24);
    const local = buf.readUInt32LE(p + 42);
    p += 46 + buf.readUInt16LE(p + 28) + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    total += declarado;
    if (declarado > DOCX_MAX_ENTRADA || total > DOCX_MAX_TOTAL) return false;
    // Los datos están después del encabezado local, que tiene su propio nombre y extra.
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== FIRMA_LOCAL) return false;
    const desde = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (desde + comprimido > buf.length) return false;
    if (metodo === 0) {
      if (comprimido !== declarado) return false;
    } else if (metodo === 8) {
      try {
        const real = inflateRawSync(buf.subarray(desde, desde + comprimido), {
          maxOutputLength: Math.max(1, declarado),
        });
        if (real.length !== declarado) return false;
      } catch {
        // Más grande que lo declarado (corta en el tope) o deflate roto.
        return false;
      }
    } else {
      // pizzip solo entiende «guardado» y «deflate».
      return false;
    }
  }
  return true;
}

/** Abre el .docx, o dice en castellano por qué no es uno. */
function abrir(buffer: Buffer): { zip: PizZip } | { problema: string } {
  if (buffer.subarray(0, 4).toString('latin1') !== 'PK\x03\x04')
    return { problema: 'El archivo no es un Word (.docx). Abrilo en Word y guardalo como .docx.' };
  if (!tamaniosRazonables(buffer)) return { problema: WORD_DEMASIADO_GRANDE };
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

/**
 * Los marcadores contra los que se revisa un Word: los del contrato
 * (`MARCADORES_PLANTILLA`) o los de la reserva (`MARCADORES_RESERVA`, regla
 * 162). Cada tipo de plantilla tiene su lista y un Word se revisa contra la
 * suya: `{reserva.numero}` no existe en un contrato.
 */
interface Catalogo {
  lista: readonly MarcadorPlantilla[];
  porNombre: Map<string, MarcadorPlantilla>;
  /** Los nombres de texto, que se pueden usar desde cualquier lugar. */
  textos: Set<string>;
}

function catalogo(lista: readonly MarcadorPlantilla[]): Catalogo {
  return {
    lista,
    porNombre: new Map(lista.map((m) => [m.nombre, m])),
    textos: new Set(lista.filter((m) => m.tipo === 'texto').map((m) => m.nombre)),
  };
}

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

function conocidoEn(nombre: string, niveles: Nivel[], cat: Catalogo): boolean {
  return cat.textos.has(nombre) || niveles.some((n) => n.abierto || n.campos.has(nombre));
}

/** Por qué un marcador que existe no se puede usar como dato suelto. */
function malUsado(m: MarcadorPlantilla, cat: Catalogo): string {
  const textos = cat.lista
    .filter((t) => t.tipo === 'texto' && t.nombre.startsWith(`${m.nombre}.`))
    .map((t) => `{${t.nombre}}`);
  const como = `{#${m.nombre}}…{/${m.nombre}}`;
  return m.tipo === 'lista'
    ? `«{${m.nombre}}» es una lista: se usa como ${como}${textos.length ? `, o ${textos.join(' / ')} para todos juntos` : ''}.`
    : `«{${m.nombre}}» es una condición: se usa como ${como}${textos.length ? `; el dato es ${textos.join(' / ')}` : ''}.`;
}

/** Recorre los marcadores con el alcance de cada uno: adentro de una lista valen sus campos. */
function revisar(partes: Parte[], niveles: Nivel[], problemas: Set<string>, cat: Catalogo): void {
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
    const marcador = cat.porNombre.get(nombre);
    if (parte.module === 'loop') {
      let nivel: Nivel;
      if (marcador && marcador.tipo !== 'texto') {
        nivel = { campos: new Set((marcador.campos ?? []).map((c) => c.nombre)) };
      } else if (conocidoEn(nombre, niveles, cat)) {
        // Una condición sobre un dato de texto: aparece si el dato no está vacío.
        nivel = { campos: new Set() };
      } else {
        problemas.add(desconocido(nombre, niveles, cat));
        // Lo de adentro no se revisa contra una sección que no existe: sería
        // repetir el mismo error por cada campo.
        nivel = { campos: new Set(), abierto: true };
      }
      revisar(parte.subparsed ?? [], [...niveles, nivel], problemas, cat);
      continue;
    }
    if (conocidoEn(nombre, niveles, cat)) continue;
    if (marcador) problemas.add(malUsado(marcador, cat));
    else problemas.add(desconocido(nombre, niveles, cat));
  }
}

function desconocido(nombre: string, niveles: Nivel[], cat: Catalogo): string {
  const listas = cat.lista.filter((m) => m.campos?.some((c) => c.nombre === nombre));
  if (listas.length)
    return `«{${nombre}}» solo se puede usar adentro de ${listas
      .map((m) => `{#${m.nombre}}…{/${m.nombre}}`)
      .join(', ')}.`;
  const candidatos = [...cat.lista.map((m) => m.nombre), ...niveles.flatMap((n) => [...n.campos])];
  return `«{${nombre}}» no es un marcador conocido.${sugerencia(nombre, candidatos)}`;
}

/** Cuántos problemas se listan como mucho: más que eso, mejor revisar el Word entero. */
const MAX_PROBLEMAS = 20;

/**
 * Lo que está mal en un Word que se quiere subir como plantilla, en
 * castellano. Vacío si se puede usar. Se revisa contra los marcadores del
 * contrato, o contra los de la reserva si es una plantilla de reserva.
 */
export function problemasDePlantilla(
  archivo: {
    buffer: Buffer;
    originalname: string;
    size: number;
  },
  marcadores: readonly MarcadorPlantilla[] = MARCADORES_PLANTILLA,
): string[] {
  const cat = catalogo(marcadores);
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
  revisar(inspeccion.getAllStructuredTags() as Parte[], [], problemas, cat);
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
