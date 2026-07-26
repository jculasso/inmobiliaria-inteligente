import { expect, test } from '@playwright/test';

/**
 * Puerta de entrada: qué se sirve sin sesión y qué exige estar logueado.
 *
 * Es lo que más veces se rompió — tres, todas iguales: el middleware pedía
 * sesión para un archivo que el navegador pide SIN sesión, y en vez del archivo
 * llegaba un redirect al login. Pasó con los íconos (la PWA no se podía
 * instalar), con la pantalla sin conexión (el service worker guardaba el login
 * en su lugar) y con el flyer comercial (el prospecto abría el link de venta y
 * se encontraba con un ingreso).
 *
 * `middleware.test.ts` ya fija la regla sobre el matcher; esto la comprueba en
 * un navegador de verdad, contra la app compilada.
 */

test('la Home muestra el formulario de ingreso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('una ruta de módulo sin sesión vuelve a la Home y recuerda el destino', async ({ page }) => {
  await page.goto('/tablero/ventas');
  // El destino viaja en `?redirect=` para poder mandarlo ahí apenas se loguee,
  // en vez de dejarlo en la Home teniendo que escribir la URL de nuevo.
  await expect(page).toHaveURL(/\/\?redirect=%2Ftablero%2Fventas/);
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('/admin no rebota: tiene su propia pantalla de ingreso', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
});

test.describe('archivos que el navegador pide sin sesión', () => {
  test('el manifest y el service worker se sirven, o la app no se puede instalar', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()).name).toBe('Inmobiliaria Inteligente');

    const sw = await request.get('/sw.js');
    expect(sw.status()).toBe(200);
  });

  test('los íconos se sirven', async ({ request }) => {
    for (const ruta of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
      const res = await request.get(ruta);
      expect(res.status(), `${ruta} debería servirse sin sesión`).toBe(200);
    }
  });

  test('la pantalla sin conexión se sirve, y no es el login disfrazado', async ({ page }) => {
    const res = await page.goto('/offline');
    expect(res?.status()).toBe(200);
    // Si el middleware la protegiera, el service worker guardaría el LOGIN como
    // pantalla de "sin conexión" — que fue exactamente lo que pasó una vez.
    await expect(page.getByRole('button', { name: 'Ingresar' })).toHaveCount(0);
  });

  test('el flyer comercial se sirve sin sesión: se lo mandamos a gente sin cuenta', async ({ request }) => {
    const res = await request.get('/flyer-comercial.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('pdf');
    const cuerpo = await res.body();
    expect(cuerpo.subarray(0, 4).toString()).toBe('%PDF');
  });
});
