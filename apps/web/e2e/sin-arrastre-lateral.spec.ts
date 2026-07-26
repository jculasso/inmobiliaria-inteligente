import { expect, test } from '@playwright/test';

/**
 * El "baile": que ninguna pantalla se pueda arrastrar de costado en el teléfono.
 *
 * La causa de fondo era el zoom automático de iOS al enfocar un campo con letra
 * menor a 16px (ver `estilos-globales.test.ts`). Esto comprueba lo otro: que el
 * contenido tampoco se pase del ancho.
 *
 * Corre en los dos proyectos, pero lo que importa es `mobile` — el problema
 * nunca existió en escritorio.
 */

/** Rutas que se pueden ver sin sesión. Las de módulo necesitan una base de prueba. */
const RUTAS_PUBLICAS = ['/', '/offline'];

for (const ruta of RUTAS_PUBLICAS) {
  test(`${ruta} no se desplaza de costado`, async ({ page }) => {
    await page.goto(ruta);

    // `poll` y no una medición suelta: la Home hace una navegación del cliente
    // al montar, y medir justo ahí tira "execution context destroyed".
    await expect
      .poll(
        () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        { message: `${ruta} desborda a lo ancho` },
      )
      .toBeLessThanOrEqual(0);
  });

  test(`${ruta}: ningún elemento se sale de la pantalla`, async ({ page }) => {
    await page.goto(ruta);

    const buscarCulpables = () =>
      page.evaluate(() => {
      const ancho = window.innerWidth;
      return [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= ancho + 1) return false;
          // Lo que vive dentro de un panel deslizable no cuenta: ahí pasarse
          // del ancho es lo esperable.
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

    await expect
      .poll(buscarCulpables, { message: `elementos que se salen en ${ruta}` })
      .toEqual([]);
  });
}

test('los campos miden 16px en el teléfono, o iOS agranda la pantalla', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'solo aplica en pantalla de teléfono');

  await page.goto('/');
  const tamano = await page
    .locator('input[type="password"]')
    .evaluate((el) => getComputedStyle(el).fontSize);

  // Menos de 16px y iOS Safari hace zoom al enfocar: la ventana visible se
  // achica y la página entera se puede arrastrar. Ese era el "baile".
  expect(parseFloat(tamano)).toBeGreaterThanOrEqual(16);
});
