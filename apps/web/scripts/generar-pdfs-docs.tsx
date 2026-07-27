import path from 'node:path';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';


/**
 * Genera los PDF de las páginas de documentación del panel.
 *
 * Se imprimen DESDE LAS MISMAS PÁGINAS que se ven en `/admin`, no desde una
 * copia: si mañana cambia el texto de la guía, se regenera y listo. Dos
 * versiones del mismo contenido siempre terminan diciendo cosas distintas.
 *
 *     pnpm --filter @vacker/web pdf:docs
 *
 * Requiere haber corrido `build` antes, porque toma el CSS ya compilado.
 *
 * Los archivos NO van a `public/`: la guía y sobre todo la página de inversión
 * son material interno. Salen a `apps/web/pdf/`, fuera del repo.
 */

/**
 * Carga las páginas del panel.
 *
 * Usan JSX sin importar React, porque Next compila con el modo automático. Este
 * script no pasa por Next, así que hay que dejar React global ANTES de
 * cargarlas — de ahí la importación diferida.
 */
async function docs() {
  (globalThis as unknown as { React: typeof React }).React = React;
  const [guia, onboarding, inversion] = await Promise.all([
    import('../app/admin/guia/page'),
    import('../app/admin/onboarding/page'),
    import('../app/admin/inversion/page'),
  ]);
  return [
    { archivo: 'guia-del-implementador.pdf', titulo: 'Guía del implementador', Componente: guia.default },
    { archivo: 'onboarding-del-equipo.pdf', titulo: 'Onboarding del equipo', Componente: onboarding.default },
    {
      archivo: 'inversion-en-infraestructura.pdf',
      titulo: 'Inversión en infraestructura',
      Componente: inversion.default,
    },
  ];
}

const RAIZ = path.join(__dirname, '..');
const FUENTES = path.join(RAIZ, '..', 'api', 'src', 'modules', 'tasador', 'informes', 'fonts');

/** El CSS que Next ya compiló, para que el PDF salga con el mismo diseño. */
async function cssCompilado(): Promise<string> {
  const dir = path.join(RAIZ, '.next', 'static', 'css');
  let archivos: string[];
  try {
    archivos = (await readdir(dir)).filter((f) => f.endsWith('.css'));
  } catch {
    throw new Error('No hay CSS compilado. Corré `pnpm --filter @vacker/web build` primero.');
  }
  const partes = await Promise.all(archivos.map((f) => readFile(path.join(dir, f), 'utf8')));
  return partes.join('\n');
}

/**
 * Montserrat incrustada en el propio HTML.
 *
 * Sin esto habría que servir los archivos por HTTP; así el documento es
 * autosuficiente y se imprime sin levantar ningún servidor.
 */
async function fuentesIncrustadas(): Promise<string> {
  const caras = [
    { archivo: 'Montserrat-Regular.ttf', peso: 400, estilo: 'normal' },
    { archivo: 'Montserrat-Italic.ttf', peso: 400, estilo: 'italic' },
    { archivo: 'Montserrat-Bold.ttf', peso: 700, estilo: 'normal' },
    { archivo: 'Montserrat-ExtraBold.ttf', peso: 800, estilo: 'normal' },
  ];
  const reglas = await Promise.all(
    caras.map(async ({ archivo, peso, estilo }) => {
      const b64 = (await readFile(path.join(FUENTES, archivo))).toString('base64');
      return `@font-face{font-family:'Montserrat';font-weight:${peso};font-style:${estilo};src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
    }),
  );
  return reglas.join('\n');
}

async function main() {
  const [css, fuentes, DOCS] = await Promise.all([cssCompilado(), fuentesIncrustadas(), docs()]);
  const salida = path.join(RAIZ, 'pdf');
  await mkdir(salida, { recursive: true });

  const navegador = await chromium.launch();
  try {
    for (const { archivo, titulo, Componente } of DOCS) {
      const cuerpo = renderToStaticMarkup(<Componente />);
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>${fuentes}</style>
<style>${css}</style>
<style>
  /* La página impresa no tiene barra lateral ni navegación: solo el contenido,
     con el ancho de una hoja y la tipografía de marca. */
  body { font-family: 'Montserrat', system-ui, sans-serif; background: #fff; }
  main { max-width: 100%; padding: 0; }
  /* Que ningún bloque quede partido entre dos hojas. */
  section, .rounded-brand { break-inside: avoid; }
</style>
</head><body><main>${cuerpo}</main></body></html>`;

      const pagina = await navegador.newPage();
      await pagina.setContent(html, { waitUntil: 'load' });
      await pagina.emulateMedia({ media: 'screen' }); // los colores de marca son de pantalla
      const pdf = await pagina.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="width:100%;font-size:8px;color:#6B6B6B;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif">' +
          '<span>INMOBILIARIA INTELIGENTE</span><span class="pageNumber"></span></div>',
      });
      await pagina.close();

      const destino = path.join(salida, archivo);
      await writeFile(destino, pdf);
      console.log(`[docs] ${archivo} — ${(pdf.length / 1024).toFixed(0)} KB`);
    }
  } finally {
    await navegador.close();
  }
}

main().catch((err) => {
  console.error('[docs] falló la generación:', err);
  process.exit(1);
});
