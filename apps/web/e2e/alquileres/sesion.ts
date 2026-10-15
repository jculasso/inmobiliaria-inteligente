import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { cookieDeSesion } from '../simulador/identidad';

/**
 * `test` con la sesión puesta: la cookie que escribiría Supabase al loguearse,
 * para un usuario que el simulador reconoce. La app pasa el middleware y pide
 * sus datos al simulador, nunca a la base.
 *
 * Además, cualquier pedido del navegador fuera de localhost se corta: si algo
 * se escapara hacia un servicio de verdad, la prueba falla en vez de llegar.
 */
export const test = base.extend<{ esTelefono: boolean }>({
  // Playwright exige desestructurar el primer parámetro, aunque no se use nada.
  // eslint-disable-next-line no-empty-pattern
  esTelefono: async ({}, usar, info) => {
    await usar(info.project.name === 'telefono');
  },
  context: async ({ context, baseURL }, usar, info) => {
    // Un escenario por prueba (y por repetición e intento): lo que cambia una no lo ve otra.
    const escenario = `${info.testId}-${info.project.name}-${info.repeatEachIndex}-${info.retry}`;
    await context.addCookies([{ ...cookieDeSesion(escenario), url: baseURL! }]);
    await context.route(
      (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
      (route) => route.abort('blockedbyclient'),
    );
    await usar(context);
  },
});

export { expect };

/**
 * Elementos que se salen de la pantalla a lo ancho — el método de
 * `sin-arrastre-lateral.spec.ts`, que no miente: `scrollWidth - innerWidth` da
 * 0 cuando algo del árbol tiene `overflow` oculto, aunque una tarjeta se salga.
 * Lo que vive dentro de un panel deslizable no cuenta: ahí pasarse es lo
 * esperable.
 */
export function elementosQueSeSalen(page: Page) {
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    return [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= ancho + 1) return false;
        let p = el.parentElement;
        while (p) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === 'auto' || ov === 'scroll') return false;
          p = p.parentElement;
        }
        return true;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} «${(el.textContent ?? '').trim().slice(0, 30)}»`,
      );
  });
}

/** Campos visibles con letra menor a 16px: en iOS, enfocarlos hace zoom y la pantalla baila. */
export function camposChicos(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const tipo = (el as HTMLInputElement).type;
        // Los que no se escriben no disparan el zoom.
        if (['checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].includes(tipo))
          return false;
        return r.width > 0 && r.height > 0 && parseFloat(getComputedStyle(el).fontSize) < 16;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}[${(el as HTMLInputElement).name || el.getAttribute('aria-label') || el.id}] ${getComputedStyle(el).fontSize}`,
      ),
  );
}

/**
 * Las comprobaciones de teléfono de cada pantalla (pedido del 15/10/2026):
 * nada se sale a lo ancho y ningún campo mide menos de 16px. En escritorio no
 * hace nada: el problema nunca existió ahí.
 */
export async function revisarEnTelefono(page: Page, esTelefono: boolean, donde: string) {
  if (!esTelefono) return;
  await expect
    .poll(() => elementosQueSeSalen(page), { message: `elementos que se salen en ${donde}` })
    .toEqual([]);
  await expect
    .poll(() => camposChicos(page), { message: `campos de menos de 16px en ${donde}` })
    .toEqual([]);
}

/**
 * Que un botón se pueda tocar: visible, habilitado, dentro de la pantalla y sin
 * nada encima. `trial` hace todas las comprobaciones de un clic (incluida la de
 * que otro elemento no lo tape) sin hacerlo.
 */
export async function esTocable(boton: Locator) {
  await boton.scrollIntoViewIfNeeded();
  await expect(boton).toBeVisible();
  await expect(boton).toBeEnabled();
  await boton.click({ trial: true });
  const tapado = await boton.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
      return 'fuera de la pantalla';
    const arriba = document.elementFromPoint(x, y);
    return arriba && (arriba === el || el.contains(arriba))
      ? null
      : `tapado por ${arriba?.tagName}`;
  });
  expect(tapado, 'el botón tiene que poder tocarse').toBeNull();
}

/**
 * Un modal en el teléfono: entra en la pantalla, su contenido se desplaza
 * hasta el final (el último botón queda a la vista) y la × lo cierra.
 */
export async function revisarModal(page: Page, dialogo: Locator, esTelefono: boolean) {
  await expect(dialogo).toBeVisible();
  if (esTelefono) {
    const caja = await dialogo.locator(':scope > div').first().boundingBox();
    const vista = page.viewportSize()!;
    expect(caja, 'el modal tiene caja').not.toBeNull();
    expect(caja!.height, 'el modal entra a lo alto').toBeLessThanOrEqual(vista.height + 1);
    expect(caja!.x, 'el modal no se sale a la izquierda').toBeGreaterThanOrEqual(-1);
    expect(caja!.x + caja!.width, 'el modal no se sale a la derecha').toBeLessThanOrEqual(
      vista.width + 1,
    );
    // El cuerpo se desplaza: al llevarlo al final, su último contenido queda dentro.
    const cuerpo = dialogo.locator('.overflow-y-auto').first();
    const llega = await cuerpo.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      const r = el.getBoundingClientRect();
      const ultimo = el.lastElementChild?.getBoundingClientRect();
      return !ultimo || ultimo.bottom <= r.bottom + 1 || el.scrollHeight <= el.clientHeight + 1;
    });
    expect(llega, 'el contenido del modal se puede desplazar hasta el final').toBe(true);
    await expect
      .poll(() => elementosQueSeSalen(page), { message: 'elementos que se salen con el modal' })
      .toEqual([]);
    await expect
      .poll(() => camposChicos(page), { message: 'campos de menos de 16px en el modal' })
      .toEqual([]);
  }
  await esTocable(dialogo.getByRole('button', { name: 'Cerrar', exact: true }));
}

/** Cierra el modal con la × y comprueba que se fue. */
export async function cerrarModal(dialogo: Locator) {
  await dialogo.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialogo).toBeHidden();
}

/**
 * Confirma una acción que guarda (el botón de un modal) y recarga la página
 * para leer lo que quedó guardado. Devuelve el pedido, para mirar qué se mandó.
 *
 * Por qué recarga en vez de esperar a que el modal se cierre solo: los modales
 * se cierran cuando termina `router.refresh()` (`useRefrescar`), y contra el
 * simulador ese refresh a veces no llega a pintarse —el modal queda en
 * «Guardando…»— en alrededor de una de cada diez corridas (15/10/2026, Next
 * 15.5 + React 19.2; navegar a otra pantalla lo destraba). Quedó anotado como
 * pendiente aparte. Mientras tanto, la prueba comprueba lo que importa —qué se
 * mandó y cómo se ve después— sin depender de esa carrera.
 */
export async function confirmarYRecargar(page: Page, boton: Locator, ruta: string) {
  const respuesta = page.waitForResponse(
    (r) => r.request().method() !== 'GET' && r.url().includes(ruta),
  );
  await boton.click();
  const r = await respuesta;
  expect(r.ok(), `${ruta} respondió ${r.status()}`).toBe(true);
  await page.reload();
  return r.request();
}
