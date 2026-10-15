import { IDS } from '../simulador/datos/comunes';
import { esTocable, expect, revisarEnTelefono, test } from './sesion';

/**
 * Un contrato que se toma ya en curso (regla 105, entrega A para Vacker): se
 * administra desde un mes, con el alquiler que corre hoy, sin deuda de antes
 * ni cargos de ingreso.
 */

test('el alta de un contrato en curso pide «Administrado desde» y el alquiler vigente, y los manda al guardar', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/contratos/nuevo');
  const falta = page.getByRole('list', { name: 'Lo que falta' });

  // 1. Partes.
  await page.getByLabel(/^Propiedad/).selectOption(IDS.propiedad);
  await page.getByLabel('Persona (propietario)').selectOption({ label: 'Carlos Gómez' });
  await page.getByLabel('Persona (inquilino)').selectOption({ label: 'Lucía Fernández' });
  await revisarEnTelefono(page, esTelefono, 'el alta de contrato, partes');
  await esTocable(page.getByRole('button', { name: 'Siguiente →' }));
  await page.getByRole('button', { name: 'Siguiente →' }).click();

  // 2. Condiciones: un contrato que empezó hace un año y medio.
  await page.getByLabel(/^Inicio/).fill('2025-03-01');
  await page.getByLabel(/^Fin/).fill('2028-02-29');
  const enCurso = page.getByLabel('Este contrato ya está en curso');
  await expect(page.getByLabel('Administrado desde')).toHaveCount(0);
  await enCurso.check();

  // Recién marcado, falta lo que lo hace un contrato en curso.
  await expect(falta).toContainText('Completá «Administrado desde».');
  await expect(falta).toContainText('Completá el alquiler vigente hoy.');
  await revisarEnTelefono(page, esTelefono, 'el alta de contrato, en curso');

  // «Administrado desde» tiene que caer DESPUÉS del inicio: el mismo día no es «en curso».
  await page.getByLabel('Administrado desde').fill('2025-03-01');
  await expect(falta).toContainText(
    '«Administrado desde» tiene que caer después del inicio y antes del fin.',
  );

  await page.getByLabel('Administrado desde').fill('2026-10-01');
  await page.getByLabel('Alquiler vigente hoy').fill('1.250.000');
  await expect(falta).toHaveCount(0);

  // 3. Tramos: el que corre el 01/10/2026 lleva el alquiler vigente.
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await page.getByRole('button', { name: 'Generar los tramos' }).click();
  await expect(
    page.getByText('El tramo que corre el 01/10/2026 lleva el alquiler vigente'),
  ).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'el alta de contrato, tramos');

  const guardar = page.getByRole('button', { name: 'Guardar en borrador' });
  await esTocable(guardar);
  const pedido = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/alquileres/contratos'),
  );
  await guardar.click();
  const body = (await pedido).postDataJSON() as {
    administradoDesde: string | null;
    tramos: { desde: string; hasta: string; importe: number | null }[];
  };
  expect(body.administradoDesde).toBe('2026-10-01');
  const vigente = body.tramos.find((t) => t.desde <= '2026-10-01' && t.hasta >= '2026-10-01');
  expect(vigente?.importe).toBe(1_250_000);
  // Los tramos de antes no hacen falta: no se administraron.
  expect(body.tramos.filter((t) => t.hasta < '2026-10-01').every((t) => t.importe == null)).toBe(
    true,
  );
  await expect(page).toHaveURL(new RegExp(`/alquileres/contratos/${IDS.contrato}$`));
});

test('sin marcar «ya está en curso» no se piden los datos del contrato en curso', async ({
  page,
}) => {
  await page.goto('/alquileres/contratos/nuevo');
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await page.getByLabel(/^Inicio/).fill('2026-11-01');
  await page.getByLabel(/^Fin/).fill('2028-10-31');
  const falta = page.getByRole('list', { name: 'Lo que falta' });
  await expect(falta).toHaveCount(0);
  await expect(page.getByText('Completá «Administrado desde».')).toHaveCount(0);
});
