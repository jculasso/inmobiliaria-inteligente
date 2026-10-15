import { expect, revisarEnTelefono, test } from './sesion';

/**
 * Regla 130: la liquidación parcial (el índice no salió) y la final (la
 * diferencia cuando salió) se distinguen de un vistazo en los conceptos del mes.
 */

test('los conceptos de una liquidación parcial y de una final llevan su insignia', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/conceptos?periodo=2026-10');

  const alt2 = page.getByRole('region', { name: 'Contrato ALT-0002' });
  const alt3 = page.getByRole('region', { name: 'Contrato ALT-0003' });
  const alt1 = page.getByRole('region', { name: 'Contrato ALT-0001' });

  // Las dos vistas (teléfono y compu) están en el DOM: cuenta la que se ve.
  await expect(
    alt2.getByText('Liquidación parcial', { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    alt2
      .getByText(
        'Alquiler octubre 2026 — liquidación parcial (espera el IPC de septiembre de 2026)',
      )
      .filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    alt3.getByText('Liquidación final', { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
  // Un alquiler común no lleva ninguna de las dos.
  await expect(
    alt1.getByText(/^Liquidación (parcial|final)$/).filter({ visible: true }),
  ).toHaveCount(0);
  await revisarEnTelefono(page, esTelefono, 'los conceptos del mes');
});
