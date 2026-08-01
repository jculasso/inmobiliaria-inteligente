import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Imprime un documento de `docs/` como PDF.
 *
 *     pnpm --filter @vacker/web pdf:tecnico
 *     pnpm --filter @vacker/web pdf:costos
 *
 * El markdown es la ÚNICA fuente: se lee del repositorio y se convierte acá.
 * Tener el texto duplicado en un HTML aparte terminaría, tarde o temprano, en
 * dos versiones que dicen cosas distintas — que es exactamente lo que este
 * documento no puede permitirse.
 *
 * El conversor de abajo cubre a mano el subconjunto de markdown que usa el
 * documento y nada más. Traer una librería entera para seis reglas sería
 * agregarle una dependencia al proyecto por un script que corre a mano.
 *
 * La tipografía va incrustada desde los .ttf del repositorio, los mismos que
 * usan los informes: Montserrat no está instalada en la máquina y el navegador
 * la reemplazaría por otra sin avisar.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
/* El documento y el nombre del PDF vienen por argumento: es el mismo molde
   para todos, y agregar uno nuevo es una línea en package.json. */
const [DOC, NOMBRE] = process.argv.slice(2);
if (!DOC || !NOMBRE) {
  console.error('  uso: node scripts/pdf-doc.mjs <archivo-en-docs.md> <nombre-del-pdf>');
  process.exit(1);
}
const ORIGEN = resolve(RAIZ, 'docs', DOC);
const SALIDA = resolve(RAIZ, 'apps/web/pdf', NOMBRE);
const FUENTES = resolve(RAIZ, 'apps/api/src/modules/tasador/informes/fonts');

const b64 = (a) => readFileSync(resolve(FUENTES, a)).toString('base64');

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Negrita, código y cursiva. Se aplica al texto ya escapado. */
function enLinea(s) {
  return escapar(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

const fila = (linea, etiqueta) =>
  '<tr>' +
  linea
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => `<${etiqueta}>${enLinea(c.trim())}</${etiqueta}>`)
    .join('') +
  '</tr>';

function aHtml(md) {
  const lineas = md.split('\n');
  const salida = [];
  let i = 0;

  while (i < lineas.length) {
    const l = lineas[i];

    if (!l.trim()) { i++; continue; }

    // Tabla: encabezado, separador de guiones, y filas hasta que se corte.
    if (l.trim().startsWith('|') && (lineas[i + 1] ?? '').includes('---')) {
      const filas = [fila(l, 'th')];
      i += 2;
      while (i < lineas.length && lineas[i].trim().startsWith('|')) {
        filas.push(fila(lineas[i], 'td'));
        i++;
      }
      salida.push(`<table>${filas.join('')}</table>`);
      continue;
    }

    const enc = l.match(/^(#{1,3}) (.*)$/);
    if (enc) {
      const n = enc[1].length;
      salida.push(`<h${n}>${enLinea(enc[2])}</h${n}>`);
      i++;
      continue;
    }

    if (l.trim() === '---') { salida.push('<hr>'); i++; continue; }

    if (l.startsWith('> ')) {
      const cita = [];
      while (i < lineas.length && lineas[i].startsWith('>')) {
        cita.push(lineas[i].replace(/^> ?/, ''));
        i++;
      }
      salida.push(`<blockquote>${enLinea(cita.join(' '))}</blockquote>`);
      continue;
    }

    const lista = l.match(/^(\s*)([-*]|\d+\.) /);
    if (lista) {
      const ordenada = /\d/.test(lista[2]);
      const items = [];
      // Las continuaciones de un item vienen indentadas: se pegan al mismo.
      while (i < lineas.length && (lineas[i].match(/^(\s*)([-*]|\d+\.) /) || /^\s{2,}\S/.test(lineas[i]))) {
        if (lineas[i].match(/^(\s*)([-*]|\d+\.) /)) {
          items.push(lineas[i].replace(/^\s*([-*]|\d+\.) /, ''));
        } else {
          items[items.length - 1] += ' ' + lineas[i].trim();
        }
        i++;
      }
      const t = ordenada ? 'ol' : 'ul';
      salida.push(`<${t}>${items.map((x) => `<li>${enLinea(x)}</li>`).join('')}</${t}>`);
      continue;
    }

    // Párrafo: junta las líneas hasta el próximo renglón en blanco.
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,3} |---|>|\||\s*([-*]|\d+\.) )/.test(lineas[i])) {
      parrafo.push(lineas[i].trim());
      i++;
    }
    if (parrafo.length) salida.push(`<p>${enLinea(parrafo.join(' '))}</p>`);
    else i++;
  }

  return salida.join('\n');
}

const HTML = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: M; font-weight: 400; src: url(data:font/ttf;base64,${b64('Montserrat-Regular.ttf')}) format('truetype'); }
  @font-face { font-family: M; font-weight: 700; src: url(data:font/ttf;base64,${b64('Montserrat-Bold.ttf')}) format('truetype'); }
  @font-face { font-family: M; font-weight: 800; src: url(data:font/ttf;base64,${b64('Montserrat-ExtraBold.ttf')}) format('truetype'); }

  * { box-sizing: border-box; }
  body { font-family: M, sans-serif; color: #1D1D1F; font-size: 10.5pt; line-height: 1.62; margin: 0; }

  h1 { font-size: 27pt; font-weight: 800; line-height: 1.14; margin: 0 0 4pt; letter-spacing: -0.4pt; }
  h2 { font-size: 15pt; font-weight: 800; margin: 22pt 0 7pt; line-height: 1.25;
       padding-top: 9pt; border-top: 2px solid #C1121F; break-after: avoid; }
  h1 + h2 { border-top: 0; padding-top: 0; margin-top: 3pt; font-size: 13pt;
            font-weight: 700; color: #6B6B6B; }
  h3 { font-size: 11.5pt; font-weight: 700; margin: 15pt 0 5pt; break-after: avoid; }

  p { margin: 0 0 8pt; }
  strong { font-weight: 700; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 9pt;
         background: #F4F5F7; padding: 1pt 3pt; border-radius: 3px; }

  ul, ol { margin: 0 0 9pt; padding-left: 15pt; }
  li { margin-bottom: 4pt; }

  blockquote { margin: 10pt 0; padding: 9pt 12pt; background: #F4F5F7;
               border-left: 3px solid #C1121F; font-size: 10pt; }
  blockquote p { margin: 0; }

  table { width: 100%; border-collapse: collapse; margin: 9pt 0 12pt;
          font-size: 9.5pt; break-inside: avoid; }
  th { text-align: left; font-weight: 700; font-size: 8pt; letter-spacing: 0.7pt;
       text-transform: uppercase; color: #6B6B6B; border-bottom: 1.5px solid #C1121F;
       padding: 5pt 8pt 5pt 0; }
  td { padding: 6pt 8pt 6pt 0; border-bottom: 1px solid #E6E6E6; vertical-align: top; }

  hr { border: 0; border-top: 1px solid #E6E6E6; margin: 16pt 0; }
  /* En el markdown cada sección va precedida de una línea de guiones, y en
     pantalla eso se ve bien. Acá el propio título ya trae su regla roja
     arriba, así que la línea gris quedaba duplicada: se esconde la que sobra.
     (Ojo con las comillas invertidas en los comentarios de este bloque: está
     todo dentro de una plantilla de texto y una sola la corta.) */
  hr:has(+ h2) { display: none; }
</style>
${aHtml(readFileSync(ORIGEN, 'utf8'))}
`;

mkdirSync(dirname(SALIDA), { recursive: true });

const navegador = await chromium.launch();
const page = await navegador.newPage();
await page.setContent(HTML, { waitUntil: 'load' });
await page.evaluate(async () => {
  await document.fonts.ready;
});

await page.pdf({
  path: SALIDA,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '18mm', left: '20mm', right: '20mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;padding:0 20mm;font-family:sans-serif;font-size:7.5pt;color:#6B6B6B;display:flex;justify-content:space-between">
      <span>Inmobiliaria Inteligente</span>
      <span class="pageNumber"></span>
    </div>`,
});

await navegador.close();
console.log(`  ${SALIDA.replace(RAIZ + '/', '')}`);
