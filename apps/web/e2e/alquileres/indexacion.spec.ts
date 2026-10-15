import { esTocable, expect, revisarEnTelefono, test } from './sesion';

/**
 * Índices atrasados (reglas 7 y 130 a 139): un tramo que empezó y cuyo índice
 * no salió ESPERA el índice —no está vencido— y se cobra como liquidación
 * parcial; al confirmarlo, los meses cobrados como parcial generan la
 * diferencia como liquidación final, y eso se avisa antes de confirmar.
 */

const tarjeta = (page: import('@playwright/test').Page, codigo: string) =>
  page.locator('li').filter({ has: page.getByRole('link', { name: new RegExp(`^${codigo} · `) }) });

test('un tramo que espera el índice va aparte y no figura como vencido', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/indexaciones');
  await expect(page.getByRole('heading', { name: /Esperando el índice · 1/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Para confirmar · 2/ })).toBeVisible();

  const espera = tarjeta(page, 'ALT-0002');
  await expect(espera).toContainText('Falta el IPC de septiembre de 2026.');
  await expect(espera).toContainText('cada mes se cobra como liquidación parcial');
  await expect(espera.getByText('Vencida', { exact: true })).toHaveCount(0);
  // Sin índice no hay nada que confirmar.
  await expect(espera.getByRole('button')).toHaveCount(0);

  // El que se pasó sin indexar, en cambio, sí está vencido.
  await expect(tarjeta(page, 'ALT-0003').getByText('Vencida', { exact: true })).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'A indexar');
});

test('en la lista de contratos, el que espera el índice dice «espera el índice», no «vencida»', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/contratos');
  const fila = (codigo: string) =>
    // En la compu es una fila de la tabla; en el teléfono, una tarjeta de la lista.
    page.locator('tr, li').filter({ hasText: codigo }).filter({ visible: true }).last();
  await expect(fila('ALT-0002')).toContainText('espera el índice');
  await expect(fila('ALT-0002')).not.toContainText('vencida');
  await expect(fila('ALT-0003')).toContainText('vencida');
  await revisarEnTelefono(page, esTelefono, 'la lista de contratos');
});

test('confirmar un tramo con meses cobrados como parcial muestra antes las diferencias que va a generar', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/indexaciones');
  const atrasado = tarjeta(page, 'ALT-0003');
  const confirmar = atrasado.getByRole('button', { name: 'Confirmar $ 763.150,00' });
  await esTocable(confirmar);

  let confirmo = false;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/confirmar')) confirmo = true;
  });
  await confirmar.click();

  // Primero la vista previa: todavía no se confirmó nada.
  await expect(atrasado).toContainText(
    'Se van a generar las diferencias de agosto de 2026 y septiembre de 2026: inquilino $ 126.300,00, propietario $ 113.670,00. Vencen el 20/10/2026.',
  );
  await expect(atrasado).toContainText(
    'Los meses ya cobrados como liquidación parcial no se tocan',
  );
  expect(confirmo).toBe(false);
  await revisarEnTelefono(page, esTelefono, 'la vista previa de las diferencias');

  // «Volver» deja todo como estaba.
  await atrasado.getByRole('button', { name: 'Volver' }).click();
  await expect(atrasado).not.toContainText('Se van a generar las diferencias');
  await confirmar.click();

  const final = atrasado.getByRole('button', { name: 'Confirmar y generar las diferencias' });
  await esTocable(final);
  const pedido = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/confirmar'),
  );
  await final.click();
  expect((await pedido).postDataJSON()).toEqual({ importe: null });
  await expect(page.getByRole('status').filter({ hasText: 'ALT-0003' })).toContainText(
    'Contrato ALT-0003: el tramo 4 quedó en $ 763.150,00. Se generó la liquidación final de agosto de 2026 y septiembre de 2026.',
  );
});

test('un tramo sin meses parciales se confirma directo, sin vista previa', async ({ page }) => {
  await page.goto('/alquileres/indexaciones');
  const comun = tarjeta(page, 'ALT-0001');
  const pedido = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/confirmar'),
  );
  await comun.getByRole('button', { name: 'Confirmar $ 1.115.386,50' }).click();
  await pedido;
  await expect(page.getByRole('status').filter({ hasText: 'ALT-0001' })).toContainText(
    'Contrato ALT-0001: el tramo 3 quedó en $ 1.115.386,50.',
  );
  await expect(page.getByText('Se van a generar las diferencias')).toHaveCount(0);
});
