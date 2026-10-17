import type { Page } from '@playwright/test';
import { esTocable, expect, revisarEnTelefono, revisarModal, cerrarModal, test } from './sesion';

/**
 * Dashboard de Alquileres en tres bloques (reglas 176 a 186): «Hoy», «Lo que
 * hay que hacer» y «Cómo vamos». «Hoy» es el 15/10/2026 de los datos de
 * prueba; la línea del mes, la que calcula la API para octubre (el pago a
 * propietarios corrido al martes 13 por el sábado 10 y el feriado del 12).
 */

/**
 * Regla 186: cuánto mide la página, en pantallas, y en qué pantalla empieza
 * «Lo que hay que hacer». Con la posición de los elementos (con la página
 * arriba de todo), no solo con `scrollHeight`: si algún día la página se
 * desplaza dentro de un contenedor, `scrollHeight` daría una pantalla y
 * mentiría. Se toma lo más grande de las dos medidas: ninguna puede quedarse
 * corta.
 */
function medir(page: Page) {
  return page.evaluate(() => {
    window.scrollTo(0, 0);
    const vh = window.innerHeight;
    const fondo = Math.max(
      document.documentElement.scrollHeight,
      ...[...document.body.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom),
    );
    const titulo = [...document.querySelectorAll('h3')].find(
      (h) => h.textContent?.trim() === 'Lo que hay que hacer',
    );
    const r = titulo?.getBoundingClientRect();
    return {
      pantallas: Math.round((fondo / vh) * 100) / 100,
      tareasArriba: r ? Math.round((r.top / vh) * 100) / 100 : null,
      tareasAbajo: r ? Math.round((r.bottom / vh) * 100) / 100 : null,
    };
  });
}

test('regla 186: la página mide como mucho 2 pantallas en la compu y 3,5 en el teléfono, y las tareas aparecen enseguida', async ({
  page,
  esTelefono,
}, info) => {
  // La compu de la regla: 1440 × 900. El teléfono es el del proyecto: 375 × 812.
  if (!esTelefono) await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/alquileres');
  await expect(page.getByRole('heading', { name: 'Cómo vamos' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);

  await expect
    .poll(async () => (await medir(page)).tareasArriba, { message: 'el título de las tareas' })
    .not.toBeNull();
  const m = await medir(page);
  info.annotations.push({ type: 'medida', description: JSON.stringify(m) });
  console.log(`regla 186 · ${info.project.name}: ${JSON.stringify(m)}`);
  expect(m.pantallas, 'pantallas de alto').toBeLessThanOrEqual(esTelefono ? 3.5 : 2);
  // Empieza dentro de la primera pantalla (la compu) o de la primera y media (el teléfono).
  expect(m.tareasAbajo!, 'dónde termina el título de las tareas').toBeLessThanOrEqual(
    esTelefono ? 1.5 : 1,
  );
  await revisarEnTelefono(page, esTelefono, 'el dashboard');
});

test('reglas 176 a 178: «Hoy», «Lo que hay que hacer» y «Cómo vamos», en ese orden, con la línea de octubre', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres');
  await expect(page.getByRole('heading', { level: 3 })).toHaveText([
    'Hoy',
    'Lo que hay que hacer',
    'Cómo vamos',
  ]);
  // Regla 178: el vencimiento el lunes 5, el pago el martes 13 con su motivo, y hoy.
  const linea = page.getByRole('img', { name: /^Octubre:/ });
  await expect(linea).toHaveAttribute('aria-label', /vencieron el lunes 5/);
  await expect(linea).toHaveAttribute(
    'aria-label',
    /se les pagó el martes 13, porque el 10 fue sábado y el 12 feriado/,
  );
  // El motivo también se lee: al lado en la compu, debajo de la línea en el teléfono.
  await expect(
    page
      .getByText(/el 10 fue sábado y el 12 feriado/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  // Regla 182: «Cómo vamos» abre en el año.
  await expect(page.getByText('2026, hasta hoy')).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'el dashboard');
});

test('regla 177: la deuda vencida abre su lista sin pedir nada, y un tramo de la leyenda abre el suyo', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres');
  let pidio = false;
  page.on('request', (r) => {
    if (r.url().includes('/alquileres/tablero/detalle')) pidio = true;
  });
  const deuda = page.getByRole('button', { name: /^Deuda vencida: \$ 600\.000\. Ver el detalle/ });
  await esTocable(deuda);
  await deuda.click();
  const dialogo = page.getByRole('dialog', { name: 'Deuda vencida de inquilinos, a hoy' });
  await expect(
    dialogo.getByText('Panadería El Trigal SRL').filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    dialogo
      .getByText(/Total \$ 600\.000,00|^\$ 600\.000,00$/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);

  // En el teléfono se toca la leyenda, no la barra de 8px.
  const tramo = page
    .getByRole('list', { name: 'Deuda vencida por antigüedad' })
    .getByRole('button', { name: /31 a 60 d/ });
  await esTocable(tramo);
  await tramo.click();
  const delTramo = page.getByRole('dialog', { name: 'Deuda vencida · 31 a 60 días, a hoy' });
  await expect(delTramo).toBeVisible();
  await cerrarModal(delTramo);
  expect(pidio).toBe(false);
});

test('reglas 179 y 180: un renglón de «Atrasado» abre su lista, con su acción', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres');
  const renglon = page.getByRole('button', { name: /^Boletas vencidas que paga la inmobiliaria/ });
  await esTocable(renglon);
  await expect(renglon).toContainText('$ 41.200');
  await renglon.click();
  const dialogo = page.getByRole('dialog', { name: 'Boletas vencidas que paga la inmobiliaria' });
  await expect(
    dialogo.getByText('ABL · cuota 5 de 12').filter({ visible: true }).first(),
  ).toBeVisible();
  // La que vence en 5 días no está acá: está en «Por vencer».
  await expect(dialogo.getByText('Aysam · cuota 10 de 12')).toHaveCount(0);
  await expect(dialogo.getByRole('link', { name: 'Ir a «Para pagar» →' })).toBeVisible();
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);
  await expect(page.getByRole('button', { name: /^Boletas que vencen en 7 días/ })).toContainText(
    '$ 18.350',
  );
});

test('regla 182: en «Cómo vamos», Mes → septiembre cambia las cuatro tarjetas y no «Hoy»; la planilla se abre', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres');
  const hoy = page.getByRole('region', { name: 'Hoy' });
  const antes = await hoy.textContent();
  const cartera = page.getByRole('button', { name: /^Cartera: / });
  await expect(cartera).toContainText('vigentes a hoy');
  const ingresos = page.getByRole('button', { name: /^Ingresos: / });
  const deAnio = await ingresos.getAttribute('aria-label');

  const periodo = page.getByRole('group', { name: 'Período' });
  await esTocable(periodo.getByRole('button', { name: 'Mes', exact: true }));
  await periodo.getByRole('button', { name: 'Mes', exact: true }).click();
  await page.getByRole('combobox', { name: 'Mes' }).selectOption({ label: 'Septiembre' });
  await expect(page).toHaveURL(/periodo=mes&mes=9/);
  // Regla 77: la cartera al cierre de septiembre; los ingresos, los del mes.
  await expect(cartera).toContainText('vigentes al 30/09/2026');
  await expect(ingresos).not.toHaveAttribute('aria-label', deAnio!);
  await expect(page.getByRole('button', { name: /^Cobrado dentro del mes: 71%/ })).toBeVisible();
  // «Hoy» no cambió.
  expect(await hoy.textContent()).toBe(antes);

  const ver = page.getByRole('button', { name: 'Ver mes por mes' });
  await esTocable(ver);
  await ver.click();
  await expect(page.getByRole('table', { name: /por mes de 2026/ })).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'la planilla abierta');
});

test('regla 79: la cartera de un mes cerrado pide su lista al abrirla, y la lista se lee en el teléfono', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres?periodo=mes&mes=9');
  const tarjeta = page.getByRole('button', { name: /^Cartera: 2\. Ver el detalle/ });
  await expect(tarjeta).toContainText('al 30/09/2026');
  await esTocable(tarjeta);
  const pedido = page.waitForRequest((r) => r.url().includes('/alquileres/tablero/detalle'));
  await tarjeta.click();
  const url = new URL((await pedido).url());
  expect(url.searchParams.get('indicador')).toBe('vigentes');
  expect(url.searchParams.get('desde')).toBe('2026-09');
  expect(url.searchParams.get('hasta')).toBe('2026-09');

  const dialogo = page.getByRole('dialog', { name: 'Contratos vigentes al 30/09/2026' });
  await expect(dialogo.getByText('ALT-0001').filter({ visible: true }).first()).toBeVisible();
  await expect(dialogo.getByText('ALT-0002').filter({ visible: true }).first()).toBeVisible();
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);
});
