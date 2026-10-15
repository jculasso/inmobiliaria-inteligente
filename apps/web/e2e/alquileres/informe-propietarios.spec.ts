import { IDS } from '../simulador/datos/comunes';
import { esTocable, expect, revisarEnTelefono, test } from './sesion';

/**
 * El informe al propietario (reglas 83 a 98): lo cobrado y lo liquidado del
 * período, y lo que la inmobiliaria pagó por él y todavía no le descontó
 * —«A descontar en la próxima liquidación» (regla 93)—.
 */

test('el informe de propietarios lista a cada uno con lo que falta descontar, y abre su informe', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/propietarios');
  await expect(page.getByRole('heading', { name: 'Informe de propietarios' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Período' })).toBeVisible();

  const visible = (texto: string | RegExp) => page.getByText(texto).filter({ visible: true });
  await expect(visible(/a descontar \$ 42\.345,67/).first()).toBeVisible();
  await expect(visible('Sin movimientos').first()).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'el informe de propietarios');

  // En la compu, el nombre en la tabla; en el teléfono, la tarjeta entera.
  const abrir = page
    .getByRole('link', { name: /Carlos Gómez/ })
    .or(page.getByRole('button', { name: /^Carlos Gómez/ }))
    .filter({ visible: true })
    .first();
  await esTocable(abrir);
  await abrir.click();
  await expect(page).toHaveURL(
    new RegExp(`/alquileres/personas/${IDS.propietario}\\?.*solapa=informe`),
  );
  await expect(page.getByRole('button', { name: '📊 Informe' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('A descontar en la próxima liquidación')).toBeVisible();
});

test('la solapa «Informe» del propietario muestra lo que se descuenta en la próxima liquidación', async ({
  page,
  esTelefono,
}) => {
  await page.goto(`/alquileres/personas/${IDS.propietario}`);
  const solapa = page.getByRole('button', { name: '📊 Informe' });
  await esTocable(solapa);

  const pedido = page.waitForRequest((r) =>
    r.url().includes(`/alquileres/informes/propietarios/${IDS.propietario}`),
  );
  await solapa.click();
  const url = new URL((await pedido).url());
  expect(url.searchParams.get('desde')).toMatch(/^\d{4}-\d{2}$/);
  expect(url.searchParams.get('hasta')).toMatch(/^\d{4}-\d{2}$/);

  const resumen = page.getByRole('list', { name: 'Resumen en ARS' });
  await expect(resumen).toContainText('A descontar en la próxima liquidación');
  await expect(resumen).toContainText('TGI (Tasa municipal) cuota 9/12');
  await expect(resumen).toContainText('$ 42.345,67');
  // El impuesto todavía no descontado lo dice; las expensas ya descontadas, no.
  await expect(page.getByText('Se descontará en la próxima liquidación').first()).toBeVisible();
  await esTocable(page.getByRole('button', { name: '📄 Descargar PDF' }));
  await revisarEnTelefono(page, esTelefono, 'la solapa Informe');
});
