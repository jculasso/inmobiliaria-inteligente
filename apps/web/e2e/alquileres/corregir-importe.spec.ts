import { IDS } from '../simulador/datos/comunes';
import {
  confirmarYEsperarCierre,
  esTocable,
  expect,
  revisarEnTelefono,
  revisarModal,
  test,
} from './sesion';

/**
 * Corregir el importe de un tramo ya confirmado (reglas 108 a 110): Florencia
 * (Vacker) acuerda con las partes un importe distinto del indexado. Lo cobrado
 * y lo liquidado no se toca; lo generado se vuelve a generar.
 */

test('el diálogo muestra cómo queda cada mes, exige el motivo y manda la corrección', async ({
  page,
  esTelefono,
}) => {
  await page.goto(`/alquileres/contratos/${IDS.contrato}`);
  await expect(page.getByRole('heading', { name: /ALT-0001/ }).first()).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'la ficha del contrato');

  // El tramo 2 (julio a octubre) ya se confirmó: se puede corregir.
  const tramo2 = page.locator('li').filter({ hasText: '01/07/2026' });
  const abrir = tramo2.getByRole('button', { name: 'Corregir importe' });
  await esTocable(abrir);
  await abrir.click();

  const dialogo = page.getByRole('dialog', { name: 'Corregir el importe del tramo 2' });
  await expect(dialogo).toContainText('Del 01/07/2026 al 31/10/2026 · hoy $ 980.000,00');

  // Los meses, con su estado: el primero sin cobrar ni liquidar viene elegido.
  const desde = dialogo.getByLabel('Desde qué mes');
  await expect(desde).toHaveValue('2026-10');
  await expect(desde.locator('option')).toHaveText([
    'julio de 2026 · cobrado: queda como está',
    'agosto de 2026 · cobrado: queda como está',
    'septiembre de 2026 · liquidado: queda como está',
    'octubre de 2026 · se vuelve a generar',
  ]);
  await expect(dialogo).toContainText('Se vuelve a generar con el importe nuevo: octubre de 2026.');

  // Desde un mes ya cobrado: la vista previa avisa que eso no se toca.
  await desde.selectOption('2026-08');
  await expect(dialogo).toContainText('Lo cobrado y lo liquidado no se toca.');
  await expect(dialogo).toContainText('agosto de 2026 (cobrado)');
  await expect(dialogo).toContainText('septiembre de 2026 (liquidado)');
  await desde.selectOption('2026-10');

  // Sin motivo no se puede corregir: queda en el historial con quién lo hizo.
  const corregir = dialogo.getByRole('button', { name: 'Corregir el importe' });
  await dialogo.getByLabel('Importe mensual nuevo').fill('1.050.000');
  await expect(corregir).toBeDisabled();
  await dialogo.getByLabel('Motivo').fill('ok');
  await expect(corregir).toBeDisabled();
  await dialogo.getByLabel('Motivo').fill('Acuerdo entre las partes después de indexar');
  await expect(corregir).toBeEnabled();

  await revisarModal(page, dialogo, esTelefono);
  await esTocable(corregir);
  const pedido = await confirmarYEsperarCierre(page, dialogo, corregir, '/tramos/2/corregir');
  expect(pedido.postDataJSON()).toEqual({
    importe: 1_050_000,
    desde: '2026-10',
    motivo: 'Acuerdo entre las partes después de indexar',
  });
  await expect(page.getByRole('heading', { name: /ALT-0001/ }).first()).toBeVisible();
});

test('un tramo que no se indexó todavía no ofrece corregir su importe', async ({ page }) => {
  await page.goto(`/alquileres/contratos/${IDS.contrato}`);
  const tramo3 = page.locator('li').filter({ hasText: '01/11/2026' });
  await expect(tramo3.getByText('A indexar')).toBeVisible();
  await expect(tramo3.getByRole('button', { name: 'Corregir importe' })).toHaveCount(0);
});
