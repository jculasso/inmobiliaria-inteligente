import { esTocable, expect, revisarEnTelefono, test } from './sesion';

/**
 * Los valores por inmobiliaria de la entrega A (reglas 99, 103, 133 y 171): lo
 * que se propone en un contrato nuevo, el sellado por tipo, los días para la
 * diferencia final y los honorarios sobre la seña retenida.
 */

test('los valores nuevos de la configuración se leen, se acotan y se guardan', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/configuracion');

  // Lo que está guardado.
  await expect(page.getByLabel(/^Honorarios \(%\)/)).toHaveValue('8');
  await expect(page.getByLabel(/^Punitorio diario/)).toHaveValue('0,3');
  await expect(page.getByLabel(/^Comercial MiPyme/)).toHaveValue('0,25');
  await expect(page.getByLabel(/^Lo paga el inquilino/)).toHaveValue('50');
  await expect(page.getByLabel(/^Días para pagar la diferencia/)).toHaveValue('5');
  await expect(page.getByLabel(/^Honorarios sobre la seña retenida/)).toHaveValue('0');
  await revisarEnTelefono(page, esTelefono, 'la configuración');

  // Contratos nuevos.
  await page.getByLabel(/^Honorarios \(%\)/).fill('9');
  const vence = page.getByLabel(/^Vence el día/);
  await vence.fill('31');
  await vence.blur();
  await expect(vence, 'el día se acota a 28: no todos los meses tienen 31').toHaveValue('28');

  // Sellado.
  await page.getByLabel(/^Comercial \(%\)/).fill('1,2');
  await page.getByLabel(/^Comercial MiPyme/).fill('0,5');

  // Liquidación final: de 0 a 60 días.
  const dias = page.getByLabel(/^Días para pagar la diferencia/);
  await dias.fill('90');
  await dias.blur();
  await expect(dias).toHaveValue('60');

  // Reservas.
  await page.getByLabel(/^Honorarios sobre la seña retenida/).fill('10');

  const guardar = page.getByRole('button', { name: 'Guardar', exact: true });
  await esTocable(guardar);
  const pedido = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith('/alquileres/configuracion'),
  );
  await guardar.click();
  expect((await pedido).postDataJSON()).toMatchObject({
    contratoHonorariosPct: 9,
    contratoDiaVencimiento: 28,
    selladoComercialPct: 1.2,
    selladoComercialMipymePct: 0.5,
    diasDiferenciaFinal: 60,
    honorariosSenaRetenidaPct: 10,
  });
  await expect(page.getByRole('status')).toContainText(
    'Guardado. Se aplica a los contratos y cargos que se carguen desde ahora.',
  );
});
