import { expect, test } from '@playwright/test';

/**
 * Las tres páginas del sitio, en un navegador de verdad.
 *
 * Lo que se comprueba es lo que un prospecto nota en los primeros diez
 * segundos: que la página cargue, que se entienda de qué se trata, que se
 * pueda navegar entre módulos y que en el teléfono no se arrastre de costado.
 */

/*
 * Tres y no cinco: se comercializan DOS módulos. El Protocolo 5 Semanas y el
 * To Do List salieron del sitio — ver el porqué en `MODULOS`, en marco.tsx.
 */
const PAGINAS = [
  { ruta: '/', titular: /Su CRM guarda las propiedades/ },
  { ruta: '/tasador', titular: /Llegue a la reunión con un informe/ },
  { ruta: '/tablero', titular: /Cuánto se vendió/ },
];

for (const { ruta, titular } of PAGINAS) {
  test(`${ruta} carga con su titular`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.locator('h1')).toContainText(titular);
  });

  test(`${ruta}: ningún elemento se sale de la pantalla`, async ({ page }) => {
    await page.goto(ruta);

    // Medir por elemento y no con `documentElement.scrollWidth`: ese valor
    // viene recortado por `overflow-x: clip` del CSS global, así que da 0
    // aunque algo se esté saliendo. Mide el síntoma que ya tapamos, no la causa.
    const culpables = () =>
      page.evaluate(() => {
        const ancho = window.innerWidth;
        return [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.right <= ancho + 1) return false;
            // Lo que vive dentro de un panel deslizable no cuenta: el diagrama
            // del ciclo y el menú de módulos se desplazan a propósito.
            let p = el.parentElement;
            while (p) {
              const ov = getComputedStyle(p).overflowX;
              if (ov === 'auto' || ov === 'scroll') return false;
              p = p.parentElement;
            }
            return true;
          })
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}`);
      });

    await expect.poll(culpables, { message: `elementos que se salen en ${ruta}` }).toEqual([]);
  });

  test(`${ruta}: los campos del formulario miden 16px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'telefono', 'solo aplica en pantalla de teléfono');

    await page.goto(ruta);
    const tamanos = await page
      .locator('input:not([type="hidden"])')
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));

    // Menos de 16px y iOS Safari hace zoom al enfocar: la ventana visible se
    // achica y la página entera se puede arrastrar.
    expect(tamanos.length).toBeGreaterThan(0);
    for (const t of tamanos) expect(t).toBeGreaterThanOrEqual(16);
  });
}

test('desde la portada se llega a los dos módulos', async ({ page }) => {
  await page.goto('/');
  for (const ruta of ['/tasador', '/tablero']) {
    // `.first()` no sirve: el encabezado trae los mismos enlaces dos veces, uno
    // para escritorio y otro para teléfono, y en cada ancho uno de los dos está
    // oculto. Hay que exigir que AL MENOS uno se vea.
    await expect(page.locator(`a[href="${ruta}"]:visible`).first()).toBeVisible();
  }
});

test('el ciclo se recorre entero saltando de módulo en módulo', async ({ page }) => {
  await page.goto('/tasador');
  await page.getByRole('link', { name: 'Tablero Comercial →' }).click();
  await expect(page.locator('h1')).toBeVisible();
  // El último vuelve al primero: el ciclo se cierra y no deja al visitante sin
  // salida al final de la segunda página.
  await page.getByRole('link', { name: 'Tasador →' }).click();
  await expect(page.locator('h1')).toContainText(/Llegue a la reunión/);
});

for (const { ruta } of PAGINAS) {
  test(`${ruta}: todas las imágenes cargan`, async ({ page }) => {
    await page.goto(ruta);
    // Las capturas se ponen a mano y el nombre del archivo se escribe a mano:
    // una letra de más y la imagen no aparece, sin error en ningún lado. Que
    // el `<img>` exista en el HTML no prueba nada — hay que mirar si el
    // navegador pudo decodificarla.
    //
    // Hay que llevar cada imagen a la vista antes de mirarla: Next las carga
    // recién cuando entran en pantalla. Se recorren una por una y no bajando
    // de a pantallas, porque cada imagen que carga estira la página y corre
    // de lugar a las de abajo — así se salteaba justo la última.
    // Solo las VISIBLES: la portada trae cada captura dos veces —la de
    // escritorio y la sacada desde un teléfono— y muestra una u otra según el
    // ancho. La que está oculta no tiene por qué cargar, y pedirle que se
    // desplace a la vista rompe el test.
    const imagenes = page.locator('img:visible');
    for (let i = 0; i < (await imagenes.count()); i++) {
      await imagenes.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    // `poll` y no una medición suelta: Next genera la versión optimizada de
    // cada imagen la primera vez que se la pide, y la captura más pesada tarda
    // unos segundos en estar lista. Sin reintentar, el test falla por lenta una
    // imagen que está perfecta.
    await expect
      .poll(
        () =>
          page.locator('img:visible').evaluateAll((imgs) =>
            imgs
              .filter(
                (i) =>
                  !(i as HTMLImageElement).complete ||
                  (i as HTMLImageElement).naturalWidth === 0,
              )
              .map((i) => (i as HTMLImageElement).getAttribute('src') ?? '(sin src)'),
          ),
        { message: `imágenes que no cargaron en ${ruta}`, timeout: 45_000 },
      )
      .toEqual([]);
  });
}

test('el encabezado fijo tapa lo que pasa por debajo', async ({ page }) => {
  // Estuvo publicado con `bg-white/90 backdrop-blur`. En Safari el desenfoque
  // no se aplica, así que las capturas del producto se veían A TRAVÉS del
  // menú: texto sobre texto, y en el teléfono era lo primero que aparecía al
  // bajar. Un fondo translúcido en un encabezado fijo es un error, no un
  // efecto — y sin este test se vuelve a colar en cualquier retoque de estilo.
  await page.goto('/');
  const fondo = await page
    .locator('header')
    .evaluate((h) => getComputedStyle(h).backgroundColor);

  const canales = fondo.match(/[\d.]+/g)?.map(Number) ?? [];
  const opacidad = canales.length === 4 ? canales[3]! : 1;
  expect(opacidad, `el encabezado es translúcido (${fondo})`).toBe(1);
});

test('al pedir una demostración, el título no queda tapado por el menú', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Pedir una demostración' }).first().click();
  await page.waitForTimeout(1200);

  const alto = await page.locator('header').evaluate((h) => h.getBoundingClientRect().height);
  const arriba = await page
    .locator('#demostracion h2')
    .evaluate((e) => e.getBoundingClientRect().top);

  // El encabezado mide 106px en teléfono. Si el título arranca por encima de
  // eso, el visitante toca el botón y ve el menú donde esperaba la sección.
  expect(arriba, 'el título quedó debajo del encabezado').toBeGreaterThanOrEqual(alto);
});

test('los recuadros de captura pendiente NO se ven en producción', async ({ page }) => {
  // Se ven trabajando en local, para no olvidarnos de sacarlas. Si alguna vez
  // aparecen en el sitio publicado, un prospecto lee "captura pendiente" en
  // lugar de una pantalla del producto.
  for (const { ruta } of PAGINAS) {
    await page.goto(ruta);
    await expect(page.locator('.border-dashed'), ruta).toHaveCount(0);
  }
});

test('el formulario rechaza datos incompletos sin recargar la página', async ({ page }) => {
  await page.goto('/#demostracion');
  await page.getByRole('button', { name: /Pedir/i }).click();
  // Los campos son `required`: el navegador frena el envío y la página sigue ahí.
  await expect(page.locator('form')).toBeVisible();
});

test('la portada hace las cinco preguntas de la presentación, en orden', async ({ page }) => {
  // El sitio y la presentación comercial cuentan lo mismo. Si en la reunión se
  // muestran cinco preguntas y el sitio ordena el contenido de otra manera, el
  // prospecto que entra después no reconoce nada.
  await page.goto('/');
  const preguntas = await page
    .locator('h2')
    .evaluateAll((hs) => hs.map((h) => h.textContent?.trim()).filter((t) => t?.startsWith('¿')));
  expect(preguntas).toEqual([
    '¿Qué es?',
    '¿Para qué sirve?',
    '¿Por qué contratarlo?',
    '¿Cómo se contrata?',
    '¿Quiénes somos?',
  ]);
});

test('en el sitio no aparece ningún importe', async ({ page }) => {
  // La regla está acordada en docs/specs/sitio-comercial.md: los precios se
  // dicen en una reunión, donde hay alguien que explica qué incluye cada línea
  // y hace la cuenta para el tamaño de esa inmobiliaria. Un número suelto en
  // una página se compara contra el de cualquier otro sin saber contra qué.
  //
  // El riesgo real es el copiar y pegar: la presentación SÍ los lleva, y el
  // texto de las dos sale del mismo lugar.
  for (const ruta of ['/', '/tasador', '/tablero']) {
    await page.goto(ruta);
    const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(texto, `hay un importe en ${ruta}`).not.toMatch(/AR\$|US\$|\$\s?\d/);
  }

  // Y que los tres conceptos sigan estando: lo que no se publica es el monto,
  // no la estructura. Que se cobra por usuario y no por módulo juega a favor.
  await page.goto('/');
  await expect(page.getByText('Consultar')).toHaveCount(3);
});
