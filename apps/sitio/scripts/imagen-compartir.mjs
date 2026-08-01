import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Genera la imagen que aparece cuando alguien comparte el link del sitio —
 * por WhatsApp, por LinkedIn, pegado en un mail.
 *
 *     pnpm --filter @vacker/sitio imagen-compartir
 *
 * Va por el navegador y no dibujando un SVG a mano porque **Montserrat no está
 * instalada en el sistema**: convertir un SVG con `sips` la reemplaza por
 * Helvetica y encima ignora los pesos, así que el titular salía en redonda.
 * Acá la fuente se incrusta desde los .ttf que ya viven en el repo (los mismos
 * que usa el generador de informes en PDF) y el resultado es idéntico al sitio.
 *
 * 1200x630 es lo que esperan WhatsApp, LinkedIn y Facebook. Más chico se ve
 * borroso; con otra proporción, recortan por donde no conviene.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const FUENTES = resolve(AQUI, '../../api/src/modules/tasador/informes/fonts');
const SALIDA = resolve(AQUI, '../app/opengraph-image.png');

const b64 = (archivo) => readFileSync(resolve(FUENTES, archivo)).toString('base64');

const HTML = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: Montserrat; font-weight: 400;
    src: url(data:font/ttf;base64,${b64('Montserrat-Regular.ttf')}) format('truetype'); }
  @font-face { font-family: Montserrat; font-weight: 700;
    src: url(data:font/ttf;base64,${b64('Montserrat-Bold.ttf')}) format('truetype'); }
  @font-face { font-family: Montserrat; font-weight: 800;
    src: url(data:font/ttf;base64,${b64('Montserrat-ExtraBold.ttf')}) format('truetype'); }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; font-family: Montserrat, sans-serif;
         background: #fff; border-top: 10px solid #C1121F; padding: 82px 80px 0; }
  .marca { display: flex; align-items: center; gap: 20px; }
  .cuadro { width: 56px; height: 56px; border-radius: 13px; background: #C1121F;
            display: flex; align-items: center; justify-content: center; }
  .nombre { font-size: 19px; font-weight: 700; color: #C1121F; letter-spacing: 3.6px; }
  h1 { margin-top: 62px; font-size: 58px; font-weight: 800; line-height: 1.22;
       color: #1D1D1F; letter-spacing: -0.5px; }
  h1 span { color: #C1121F; }
  .barra { width: 72px; height: 4px; background: #C1121F; margin-top: 46px; }
  .modulos { margin-top: 30px; font-size: 21px; color: #6B6B6B; }
  .pie { margin-top: 12px; font-size: 19px; color: #6B6B6B; }
  .pie b { color: #1D1D1F; font-weight: 700; }
</style>
<div class="marca">
  <div class="cuadro">
    <svg width="34" height="34" viewBox="0 0 56 56" fill="none">
      <path d="M12 29 L28 15 L44 29" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M17 31.5 L17 42 L39 42 L39 31.5" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <div class="nombre">INMOBILIARIA INTELIGENTE</div>
</div>

<h1>Su CRM guarda las propiedades.<br><span>Nosotros le decimos cómo va su negocio.</span></h1>

<div class="barra"></div>
<div class="modulos">Tasador · Protocolo 5 Semanas · Tablero Comercial</div>
<div class="pie">Desarrollado junto a una inmobiliaria en operación. En uso en <b>Vacker</b>.</div>
`;

const navegador = await chromium.launch();
const page = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(HTML, { waitUntil: 'load' });
// `await` de verdad adentro del navegador: devolver la promesa desde
// `evaluate` la serializa como objeto vacío y la captura sale antes de que la
// fuente esté lista — con el titular en Helvetica y sin que nada falle.
await page.evaluate(async () => {
  await document.fonts.ready;
});
const cargadas = await page.evaluate(() =>
  [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
);
console.log('  fuentes:', cargadas.join(' · '));
await page.screenshot({ path: SALIDA });
await navegador.close();

console.log(`  imagen para compartir → app/opengraph-image.png (1200x630)`);
