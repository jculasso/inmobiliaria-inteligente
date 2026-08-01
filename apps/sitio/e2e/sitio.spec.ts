import { expect, test } from '@playwright/test';

/**
 * Las cinco páginas del sitio, en un navegador de verdad.
 *
 * Lo que se comprueba es lo que un prospecto nota en los primeros diez
 * segundos: que la página cargue, que se entienda de qué se trata, que se
 * pueda navegar entre módulos y que en el teléfono no se arrastre de costado.
 */

const PAGINAS = [
  { ruta: '/', titular: /Su CRM guarda las propiedades/ },
  { ruta: '/tasador', titular: /Llegue a la reunión con un informe/ },
  { ruta: '/protocolo', titular: /una inmobiliaria que trabaja/ },
  { ruta: '/tablero', titular: /Cuánto se vendió/ },
  { ruta: '/tareas', titular: /Lo que hay que hacer/ },
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

test('desde la portada se llega a los cuatro módulos', async ({ page }) => {
  await page.goto('/');
  for (const ruta of ['/tasador', '/protocolo', '/tablero', '/tareas']) {
    // `.first()` no sirve: el encabezado trae los mismos enlaces dos veces, uno
    // para escritorio y otro para teléfono, y en cada ancho uno de los dos está
    // oculto. Hay que exigir que AL MENOS uno se vea.
    await expect(page.locator(`a[href="${ruta}"]:visible`).first()).toBeVisible();
  }
});

test('el ciclo se recorre entero saltando de módulo en módulo', async ({ page }) => {
  await page.goto('/tasador');
  for (const siguiente of ['Protocolo 5 Semanas', 'Tablero Comercial', 'To Do List']) {
    await page.getByRole('link', { name: `${siguiente} →` }).click();
    await expect(page.locator('h1')).toBeVisible();
  }
  // El último vuelve al primero: el ciclo se cierra y no deja al visitante sin
  // salida al final de la cuarta página.
  await page.getByRole('link', { name: 'Tasador →' }).click();
  await expect(page.locator('h1')).toContainText(/Llegue a la reunión/);
});

test('los recuadros de captura pendiente NO se ven en producción', async ({ page }) => {
  // Se ven trabajando en local, para no olvidarnos de sacarlas. Si alguna vez
  // aparecen en el sitio publicado, un prospecto lee "captura pendiente" en
  // lugar de una pantalla del producto.
  await page.goto('/protocolo');
  await expect(page.locator('.border-dashed')).toHaveCount(0);
});

test('el formulario rechaza datos incompletos sin recargar la página', async ({ page }) => {
  await page.goto('/#demostracion');
  await page.getByRole('button', { name: /Pedir/i }).click();
  // Los campos son `required`: el navegador frena el envío y la página sigue ahí.
  await expect(page.locator('form')).toBeVisible();
});
