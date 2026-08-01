import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Saca las capturas del producto que ilustran el sitio comercial.
 *
 * Por qué existe esto en vez de sacarlas a mano: las once capturas se van a
 * volver viejas —cambian los datos de la demostración, cambia una pantalla— y
 * rehacerlas a mano cada vez es el tipo de tarea que no se hace. Acá se
 * rehacen todas con un comando.
 *
 *     pnpm --filter @vacker/sitio capturas
 *
 * **La sesión la abre la persona, no el script.** El navegador arranca con un
 * perfil propio que queda guardado, así que la clave se escribe UNA vez y las
 * corridas siguientes entran solas. El script nunca ve ni guarda la clave.
 *
 * Va contra la inmobiliaria de DEMOSTRACIÓN y solo lee: navega y fotografía.
 * No marca acciones ni crea nada. Nunca contra Vacker — son datos de un
 * cliente real y no van en material comercial.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(AQUI, '../public/capturas');
const PERFIL = resolve(AQUI, '../.perfil-capturas');
const APP = process.env.APP_URL ?? 'https://app.inmobiliariainteligente.net';

/** Identificadores de la inmobiliaria de demostración (Alteva Propiedades). */
const ALSINA = '68c23132-10a0-450c-9096-cc01154b5d97'; // 23 días, 10 hechas, 6 atrasadas
/** La tasación de la que nació ese protocolo: 6 comparables cargados. */
const ALSINA_TASACION = 'e7b49da5-b1cf-4beb-adcb-b454de2354db';

const ESCRITORIO = { width: 1280, height: 800 };
const TELEFONO = { width: 375, height: 812 };
/* Una tablet en vertical. El vendedor que no usa el teléfono usa esto. */
const TABLET = { width: 820, height: 1180 };

/*
 * El Tablero abre en el mes en curso. Si se corre esto un día 1, sale todo en
 * cero y la captura no muestra nada. Julio 2026 es el último mes cerrado y el
 * más cargado: 20 operaciones, $5.638.000.
 */
const MES = { anio: '2026', nombre: 'Julio' };

/** Cada captura: adónde ir, en qué ancho, y qué hacer antes de disparar. */
const CAPTURAS = [
  {
    archivo: 'protocolo-ficha.png',
    ruta: `/protocolo/${ALSINA}`,
    tamano: ESCRITORIO,
    espera: 'Semana',
  },
  {
    archivo: 'protocolo-ficha-telefono.png',
    ruta: `/protocolo/${ALSINA}`,
    tamano: TELEFONO,
    espera: 'Semana',
  },
  {
    archivo: 'protocolo-panel.png',
    ruta: '/protocolo',
    tamano: ESCRITORIO,
    espera: 'comercialización',
  },
  {
    archivo: 'protocolo-correo-lunes.png',
    ruta: '/protocolo/reporte',
    tamano: TELEFONO,
    espera: 'eporte',
  },
  {
    archivo: 'tablero-kpis.png',
    ruta: '/tablero',
    tamano: ESCRITORIO,
    espera: 'Dashboard',
    antes: elegirMes,
  },
  {
    archivo: 'tablero-telefono.png',
    ruta: '/tablero',
    tamano: TELEFONO,
    espera: 'Dashboard',
    antes: elegirMes,
  },
  {
    archivo: 'tablero-objetivos.png',
    ruta: '/tablero/vendedores',
    tamano: ESCRITORIO,
    espera: 'endedor',
  },
  /*
   * El To Do List no tiene captura y no es un olvido: la cuenta de la
   * demostración no tiene calendario vinculado, y vincular uno mostraría la
   * agenda personal de quien lo vincule en un sitio público. La página del
   * módulo se sostiene sin imagen — de los cuatro es el más simple y el texto
   * lo dice con todas las letras.
   */
  {
    archivo: 'tasador-tasaciones.png',
    ruta: '/tasador/tasaciones',
    tamano: ESCRITORIO,
    espera: 'asacion',
  },
  {
    archivo: 'tasador-wizard.png',
    // `?seccion=4` abre directo el paso de comparables. Se llega ahí y no
    // clickeando "Siguiente": cada "Siguiente" dispara un PATCH que guarda
    // la sección, y este script no tiene por qué escribir en la base de un
    // cliente para sacar una foto.
    ruta: `/tasador/tasaciones/${ALSINA_TASACION}/editar?seccion=4`,
    tamano: ESCRITORIO,
    espera: 'Progreso',
  },
  {
    archivo: 'tasador-telefono.png',
    ruta: `/tasador/tasaciones/${ALSINA_TASACION}/editar?seccion=4`,
    tamano: TELEFONO,
    espera: 'Progreso',
  },
  {
    archivo: 'protocolo-tablet.png',
    ruta: `/protocolo/${ALSINA}`,
    tamano: TABLET,
    espera: 'Semana',
  },
];

/**
 * El Tablero abre en el mes en curso; hay que llevarlo a uno con datos.
 *
 * Van por `selectOption` y no por click: el año y el mes son `<select>`, y
 * hacerles click solo abre el desplegable — la primera versión de esto creía
 * haber elegido julio y la captura salió con agosto en cero.
 */
async function elegirMes(page) {
  for (const s of await page.locator('select').all()) {
    const opciones = await s.locator('option').allTextContents();
    for (const buscado of [MES.anio, MES.nombre]) {
      if (opciones.some((o) => o.trim() === buscado)) {
        await s.selectOption({ label: buscado });
        await page.waitForTimeout(700);
      }
    }
  }
}

/**
 * Saca de la pantalla el correo de quien sacó la captura.
 *
 * Las capturas van a un sitio público. El encabezado del producto muestra el
 * correo de la sesión, que es una dirección personal de verdad — publicarla
 * sería regalar una casilla al spam, y encima no tiene nada que ver con la
 * inmobiliaria inventada que se está mostrando. Se reemplaza por una del
 * dominio de la demostración, que es lo que un prospecto espera ver ahí.
 */
async function ocultarCorreo(page) {
  await page.evaluate(() => {
    const paseador = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = paseador.nextNode(); n; n = paseador.nextNode()) {
      if (n.nodeValue && n.nodeValue.includes('@')) {
        n.nodeValue = n.nodeValue.replace(
          /[\w.+-]+@[\w.-]+\.\w+/g,
          'direccion@altevapropiedades.com.ar',
        );
      }
    }
  });
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PERFIL, {
    headless: false,
    viewport: ESCRITORIO,
    deviceScaleFactor: 2, // el doble de píxeles: en pantallas retina no se ve borroso
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  await page.goto(APP, { waitUntil: 'domcontentloaded' });

  if (await page.locator('input[type="password"]').count()) {
    console.log('\n  Hay que iniciar sesión en la ventana que se abrió.');
    console.log('  Usuario de DIRECCIÓN de la inmobiliaria de demostración.');
    console.log('  Se hace una sola vez: el perfil queda guardado.\n');
    await page
      .getByText(/Cerrar sesión/i)
      .first()
      .waitFor({ timeout: 5 * 60_000 });
    console.log('  Sesión abierta.\n');
  }

  const hechas = [];
  const fallidas = [];

  for (const c of CAPTURAS) {
    try {
      await page.setViewportSize(c.tamano);
      await page.goto(APP + c.ruta, { waitUntil: 'domcontentloaded' });
      await page.getByText(new RegExp(c.espera, 'i')).first().waitFor({ timeout: 30_000 });
      if (c.antes) await c.antes(page);
      // Las imágenes y las animaciones de entrada necesitan un momento; sin
      // esto salen fotos con la mitad de la pantalla todavía en blanco.
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1200);
      // Al final de todo: cualquier navegación previa lo habría deshecho.
      await ocultarCorreo(page);

      await page.screenshot({ path: `${DESTINO}/${c.archivo}` });
      const ancho = c.tamano.width;
      console.log(`  ✓ ${c.archivo.padEnd(34)} ${ancho}px`);
      hechas.push(c.archivo);
    } catch (e) {
      console.log(`  ✗ ${c.archivo.padEnd(34)} ${String(e.message).split('\n')[0].slice(0, 70)}`);
      fallidas.push(c.archivo);
    }
  }

  console.log(`\n  ${hechas.length} capturas en public/capturas/`);
  if (fallidas.length) console.log(`  ${fallidas.length} fallaron: ${fallidas.join(', ')}`);
  console.log('');

  await ctx.close();
}

main().catch((e) => {
  console.error('\n  Falló:', e.message, '\n');
  process.exit(1);
});
