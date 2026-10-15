import { esTocable, expect, revisarEnTelefono, revisarModal, cerrarModal, test } from './sesion';

/**
 * Dashboard de Alquileres (reglas 74 a 80): el período de toda la pantalla, la
 * foto de la cartera al cierre de un mes pasado y la lista de cada número, que
 * se pide al abrir su tarjeta. «Hoy» es el 15/10/2026 de los datos de prueba.
 */

test('el período Mes, Trimestre o Año cambia la foto de la cartera: un mes cerrado se ve «al 30/09/2026»', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres');
  const cartera = page.getByRole('heading', { name: /Cartera/ });
  const periodo = page.getByRole('group', { name: 'Período' });

  // Sin nada en la dirección: el mes en curso, a hoy.
  await expect(cartera).toContainText('a hoy');
  await expect(page.getByRole('combobox', { name: 'Mes' })).toHaveValue('10');
  await revisarEnTelefono(page, esTelefono, 'el dashboard');

  // Un mes ya cerrado: la cartera es la de su último día, no la de hoy.
  await page.getByRole('combobox', { name: 'Mes' }).selectOption({ label: 'Septiembre' });
  await expect(cartera).toContainText('al 30/09/2026');
  await expect(page).toHaveURL(/mes=9/);

  // El trimestre que lo contiene termina el mismo día.
  await esTocable(periodo.getByRole('button', { name: 'Trimestre' }));
  await periodo.getByRole('button', { name: 'Trimestre' }).click();
  await expect(page.getByRole('group', { name: 'Trimestre' })).toBeVisible();
  await expect(cartera).toContainText('al 30/09/2026');

  // El año entero no terminó: vuelve a ser a hoy.
  await periodo.getByRole('button', { name: 'Año' }).click();
  await expect(cartera).toContainText('a hoy');
  await expect(page.getByRole('combobox', { name: 'Mes' })).toHaveCount(0);
  await revisarEnTelefono(page, esTelefono, 'el dashboard por año');
});

test('la tarjeta de un mes cerrado pide su lista al abrirla, y la lista se lee en el teléfono', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres?periodo=mes&mes=9');
  await expect(page.getByRole('heading', { name: /Cartera/ })).toContainText('al 30/09/2026');

  const tarjeta = page.getByRole('button', { name: /^Contratos vigentes: 2\. Ver el detalle/ });
  await esTocable(tarjeta);
  // Regla 79: la lista de un período cerrado no viaja con el tablero, se pide.
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

test('la tarjeta a hoy abre su lista sin pedir nada', async ({ page, esTelefono }) => {
  await page.goto('/alquileres');
  let pidio = false;
  page.on('request', (r) => {
    if (r.url().includes('/alquileres/tablero/detalle')) pidio = true;
  });
  await page.getByRole('button', { name: /^Contratos vigentes: 2\. Ver el detalle/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Contratos vigentes, a hoy' });
  await expect(
    dialogo.getByText('Lucía Fernández').filter({ visible: true }).first(),
  ).toBeVisible();
  expect(pidio).toBe(false);
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);
});
