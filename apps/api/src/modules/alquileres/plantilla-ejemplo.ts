import PizZip from 'pizzip';
import { MARCADORES_PLANTILLA, type CampoMarcador } from '@vacker/types';

/**
 * La plantilla de ejemplo que se descarga desde «Plantillas de contrato»:
 * todos los marcadores con qué ponen, cómo se escriben las condiciones y las
 * listas, y un contrato de locación armado con ellos para arrancar.
 *
 * Se arma acá, a mano, y no con una librería de Word: un .docx mínimo son
 * tres archivos de texto adentro de un ZIP, y lo que hace falta escribir son
 * párrafos y tablas. Sale de `MARCADORES_PLANTILLA`, así que un marcador
 * nuevo aparece solo.
 *
 * Es además una plantilla válida: subirla tal cual funciona (lo comprueba un
 * test), y al descargar un contrato con ella, cada tabla muestra el dato real
 * al lado de su explicación.
 */

type Bloque =
  | { t: 'titulo' | 'subtitulo' | 'clausula' | 'parrafo' | 'nota'; texto: string }
  | { t: 'tabla'; encabezado: string[]; filas: string[][] };

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Un párrafo con un solo tramo de texto. Tamaños en medios puntos (22 = 11 pt). */
function parrafo(
  texto: string,
  { negrita = false, tamano = 22, antes = 0, despues = 120, gris = false } = {},
): string {
  const rPr =
    `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>` +
    `${negrita ? '<w:b/>' : ''}${gris ? '<w:color w:val="6B6B6B"/>' : ''}` +
    `<w:sz w:val="${tamano}"/></w:rPr>`;
  return (
    `<w:p><w:pPr><w:spacing w:before="${antes}" w:after="${despues}"/></w:pPr>` +
    `<w:r>${rPr}<w:t xml:space="preserve">${escapar(texto)}</w:t></w:r></w:p>`
  );
}

function celda(texto: string, ancho: number, encabezado: boolean): string {
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>` +
    `${encabezado ? '<w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/>' : ''}</w:tcPr>` +
    parrafo(texto, { negrita: encabezado, tamano: 20, despues: 0 }) +
    `</w:tc>`
  );
}

/** Tabla de ancho completo (A4 con márgenes de 2 cm: 9638 twips). */
function tabla(encabezado: string[], filas: string[][]): string {
  const anchos = encabezado.length === 3 ? [3000, 3638, 3000] : [4819, 4819];
  const borde = (lado: string) =>
    `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
  const fila = (celdas: string[], enc: boolean) =>
    `<w:tr>${celdas.map((c, i) => celda(c, anchos[i] ?? 3000, enc)).join('')}</w:tr>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblBorders>` +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borde).join('') +
    `</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>` +
    fila(encabezado, true) +
    filas.map((f) => fila(f, false)).join('') +
    `</w:tbl>` +
    // Word no admite una tabla pegada al final de una celda o del documento.
    parrafo('', { despues: 0 })
  );
}

function bloqueXml(b: Bloque): string {
  switch (b.t) {
    case 'titulo':
      return parrafo(b.texto, { negrita: true, tamano: 32, despues: 240 });
    case 'subtitulo':
      return parrafo(b.texto, { negrita: true, tamano: 26, antes: 360, despues: 160 });
    case 'clausula':
      return parrafo(b.texto, { negrita: true, tamano: 22, antes: 200, despues: 80 });
    case 'nota':
      return parrafo(b.texto, { tamano: 20, gris: true });
    case 'parrafo':
      return parrafo(b.texto);
    case 'tabla':
      return tabla(b.encabezado, b.filas);
  }
}

/** Un .docx con estos bloques: tipo de contenido, relaciones y el documento. */
export function documentoWord(bloques: Bloque[]): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `</Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      bloques.map(bloqueXml).join('') +
      // A4 con márgenes de 2 cm.
      `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
      `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>` +
      `</w:sectPr></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const filaCampo = (c: CampoMarcador) => [`{${c.nombre}}`, c.descripcion, c.ejemplo];

/** Las partes de la guía: cómo se escribe y cada marcador con su explicación. */
function guia(): Bloque[] {
  const textos = MARCADORES_PLANTILLA.filter((m) => m.tipo === 'texto');
  const condiciones = MARCADORES_PLANTILLA.filter((m) => m.tipo === 'condicion');
  const listas = MARCADORES_PLANTILLA.filter((m) => m.tipo === 'lista');
  return [
    { t: 'titulo', texto: 'Plantilla de contrato: ejemplo con todos los marcadores' },
    {
      t: 'parrafo',
      texto:
        'Este archivo es una guía y un punto de partida. Copiá los marcadores que necesites a tu propio contrato en Word, o editá este mismo, y subilo en Configuración → Plantillas de contrato. Desde cada contrato se descarga el Word con los datos completos.',
    },
    { t: 'subtitulo', texto: 'Cómo se escriben' },
    {
      t: 'parrafo',
      texto:
        'Un dato va entre llaves, con su nombre exacto: {contrato.codigo}. Al descargar el contrato, se reemplaza por el dato de ese contrato.',
    },
    {
      t: 'parrafo',
      texto:
        'Una parte que aparece solo si se cumple algo va entre {#deposito}la apertura y el cierre{/deposito}. Con ^ en vez de #, aparece solo si NO se cumple: {^deposito}este texto sale cuando no hay depósito{/deposito}.',
    },
    {
      t: 'parrafo',
      texto:
        'Una lista repite lo que encierra una vez por elemento, y adentro se usan sus campos: {#tramos}del {desde} al {hasta}, {importe}; {/tramos}',
    },
    {
      t: 'nota',
      texto:
        'Si la apertura y el cierre están solos, cada uno en su párrafo, se repite (o se oculta) el párrafo entero: es la forma de poner una línea por tramo o por garante. Al subir la plantilla se revisan todos los marcadores, y si alguno está mal escrito te decimos cuál.',
    },
    { t: 'subtitulo', texto: 'Datos del contrato' },
    {
      t: 'tabla',
      encabezado: ['Marcador', 'Qué pone', 'Ejemplo'],
      filas: textos.map((m) => [`{${m.nombre}}`, m.descripcion, m.ejemplo]),
    },
    { t: 'subtitulo', texto: 'Condiciones' },
    {
      t: 'tabla',
      encabezado: ['Marcador', 'Cuándo aparece', 'Ejemplo'],
      filas: condiciones.map((m) => [`{#${m.nombre}}…{/${m.nombre}}`, m.descripcion, m.ejemplo]),
    },
    { t: 'subtitulo', texto: 'Listas' },
    ...listas.flatMap((m): Bloque[] => [
      { t: 'clausula', texto: `${m.descripcion}: ${m.ejemplo}` },
      {
        t: 'nota',
        texto: `Los campos de abajo valen solo entre la apertura y el cierre de la lista, como en esta tabla.`,
      },
      { t: 'parrafo', texto: `{#${m.nombre}}` },
      {
        t: 'tabla',
        encabezado: ['Campo', 'Qué pone', 'Ejemplo'],
        filas: (m.campos ?? []).map(filaCampo),
      },
      { t: 'parrafo', texto: `{/${m.nombre}}` },
    ]),
  ];
}

/**
 * Un contrato de locación armado con los marcadores (el que antes era el
 * modelo del editor de texto). Es un punto de partida: se revisa con el
 * abogado de la inmobiliaria antes de usarlo.
 */
function contratoModelo(): Bloque[] {
  return [
    { t: 'subtitulo', texto: 'Un contrato de ejemplo' },
    {
      t: 'nota',
      texto:
        'Un punto de partida armado con los marcadores de arriba. Revisalo con el abogado de la inmobiliaria antes de usarlo.',
    },
    { t: 'titulo', texto: 'CONTRATO DE LOCACIÓN' },
    {
      t: 'parrafo',
      texto:
        'Entre {propietarios.texto}, en adelante «LA PARTE LOCADORA», y {inquilinos.texto}, en adelante «LA PARTE LOCATARIA», convienen en celebrar el presente contrato de locación, que se regirá por las siguientes cláusulas.',
    },
    { t: 'clausula', texto: 'PRIMERA · Objeto' },
    {
      t: 'parrafo',
      texto:
        'LA PARTE LOCADORA da en locación a LA PARTE LOCATARIA, y esta acepta, el inmueble ubicado en {propiedad.direccion}, {propiedad.ciudad}, que LA PARTE LOCATARIA declara conocer y recibir en buen estado de conservación.',
    },
    { t: 'clausula', texto: 'SEGUNDA · Plazo' },
    {
      t: 'parrafo',
      texto:
        'El plazo de la locación es de {contrato.meses} meses, desde el {contrato.inicio} hasta el {contrato.fin}, fecha en que LA PARTE LOCATARIA deberá restituir el inmueble libre de ocupantes y en el estado en que lo recibió, salvo el desgaste por el uso normal.',
    },
    { t: 'clausula', texto: 'TERCERA · Precio' },
    {
      t: 'parrafo',
      texto:
        'El alquiler mensual inicial es de {alquiler.inicial} ({alquiler.inicial.letras}), que se paga por mes adelantado del 1 al {vencimiento.dia} de cada mes en las oficinas de {inmobiliaria} o por transferencia a la cuenta que esta indique.',
    },
    { t: 'clausula', texto: 'CUARTA · Actualización' },
    {
      t: 'parrafo',
      texto:
        '{#indexado}El precio se actualiza según {ajuste}.{/indexado}{#escalonado}El precio se ajusta según los importes escalonados que se detallan.{/escalonado} Los tramos son:',
    },
    { t: 'parrafo', texto: '{#tramos}' },
    { t: 'parrafo', texto: 'Tramo {numero}: del {desde} al {hasta}, {importe}.' },
    { t: 'parrafo', texto: '{/tramos}' },
    { t: 'clausula', texto: 'QUINTA · Mora' },
    {
      t: 'parrafo',
      texto:
        'La falta de pago en término produce la mora automática, sin necesidad de interpelación, y devenga un interés punitorio del {punitorio} diario sobre lo adeudado.',
    },
    { t: 'clausula', texto: 'SEXTA · Depósito en garantía' },
    {
      t: 'parrafo',
      texto:
        '{#deposito}LA PARTE LOCATARIA entrega en este acto {importe} ({letras}) en concepto de depósito en garantía, que se devolverá al finalizar la locación, una vez verificado el estado del inmueble y el pago de todas las obligaciones a su cargo.{/deposito}{^deposito}Las partes no pactan depósito en garantía.{/deposito}',
    },
    { t: 'clausula', texto: 'SÉPTIMA · Garantía' },
    { t: 'parrafo', texto: '{#garantes}' },
    {
      t: 'parrafo',
      texto:
        '{texto} se constituye en fiador solidario, liso, llano y principal pagador de todas las obligaciones de LA PARTE LOCATARIA, con renuncia a los beneficios de excusión y división.',
    },
    { t: 'parrafo', texto: '{/garantes}' },
    { t: 'parrafo', texto: '{^garantes}' },
    { t: 'parrafo', texto: 'No se constituye garantía personal.' },
    { t: 'parrafo', texto: '{/garantes}' },
    { t: 'clausula', texto: 'OCTAVA · Destino y conservación' },
    {
      t: 'parrafo',
      texto:
        'El inmueble se destina exclusivamente a {contrato.destino}. LA PARTE LOCATARIA no puede cederlo ni subalquilarlo, y se obliga a conservarlo en buen estado y a permitir su inspección con aviso previo.',
    },
    { t: 'clausula', texto: 'NOVENA · Servicios e impuestos' },
    {
      t: 'parrafo',
      texto:
        'Los servicios de luz, gas, agua y las expensas ordinarias están a cargo de LA PARTE LOCATARIA desde la entrega de la posesión; los impuestos que gravan el inmueble y las expensas extraordinarias, a cargo de LA PARTE LOCADORA, salvo pacto en contrario.',
    },
    { t: 'clausula', texto: 'DÉCIMA · Domicilios y jurisdicción' },
    {
      t: 'parrafo',
      texto:
        'Las partes constituyen domicilio en los indicados al comienzo, donde serán válidas todas las notificaciones, y se someten a los tribunales ordinarios de {propiedad.ciudad}.',
    },
    {
      t: 'parrafo',
      texto:
        'En prueba de conformidad se firman tantos ejemplares como partes, de un mismo tenor y a un solo efecto, en {propiedad.ciudad}, el {fecha.hoy}.',
    },
  ];
}

/** El .docx de ejemplo que se descarga. */
export function plantillaDeEjemplo(): Buffer {
  return documentoWord([...guia(), ...contratoModelo()]);
}
