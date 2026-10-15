import { IDS } from '../simulador/datos/comunes';
import { ID_RESERVA_NUEVA } from '../simulador/datos/reservas';
import {
  confirmarYRecargar,
  esTocable,
  expect,
  revisarEnTelefono,
  revisarModal,
  test,
} from './sesion';

/**
 * Reservas (reglas 153 a 172): el paso antes del contrato. Se reserva con una
 * seña, se estudian las garantías, se aprueba y se convierte en contrato; o se
 * cierra porque el interesado no se presentó, y la seña queda para el
 * propietario. Cada prueba tiene su propio escenario en el simulador: lo que
 * cambia una no lo ve otra.
 */

const titulo = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: /^Reserva \d+/ });

test('la lista muestra las abiertas y, con «Todas», también las cerradas', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/reservas');
  await expect(page.getByRole('heading', { name: 'Reservas', exact: true })).toBeVisible();
  const visible = (texto: string | RegExp) => page.getByText(texto).filter({ visible: true });

  await expect(visible('Reservada').first()).toBeVisible();
  await expect(visible('Aprobada').first()).toBeVisible();
  await expect(visible('No se presentó a firmar')).toHaveCount(0);
  await esTocable(page.getByRole('link', { name: 'Nueva reserva' }));
  await revisarEnTelefono(page, esTelefono, 'la lista de reservas');

  await page.getByLabel('Qué reservas').selectOption({ label: 'Todas' });
  await expect(page).toHaveURL(/estado=todas/);
  await expect(visible('No se presentó a firmar').first()).toBeVisible();
  await revisarEnTelefono(page, esTelefono, 'todas las reservas');
});

test('una reserva nueva pide propiedad e interesado, y al registrarla abre su ficha', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres/reservas/nueva');
  const falta = page.getByRole('list', { name: 'Lo que falta' });
  const registrar = page.getByRole('button', { name: 'Registrar la reserva' });

  await expect(falta).toContainText('Elegí la propiedad.');
  await expect(falta).toContainText('Falta el interesado (el futuro inquilino).');
  await expect(registrar).toBeDisabled();
  await revisarEnTelefono(page, esTelefono, 'la reserva nueva');

  await page.getByLabel(/^Propiedad/).selectOption(IDS.propiedad);
  await page.getByLabel('Persona (interesado)').selectOption({ label: 'Lucía Fernández' });
  await page.getByLabel(/^Seña/).fill('300.000');
  await page.getByLabel(/^Alquiler inicial/).fill('900.000');
  await expect(falta).toHaveCount(0);

  await esTocable(registrar);
  const pedido = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/alquileres/reservas'),
  );
  await registrar.click();
  const body = (await pedido).postDataJSON() as {
    propiedadId: string;
    partes: { personaId: string; papel: string }[];
    senaImporte: number;
    alquilerInicial: number;
  };
  expect(body.propiedadId).toBe(IDS.propiedad);
  expect(body.partes).toContainEqual({ personaId: IDS.inquilino, papel: 'inquilino' });
  expect(body.senaImporte).toBe(300_000);
  expect(body.alquilerInicial).toBe(900_000);

  await expect(page).toHaveURL(new RegExp(`/alquileres/reservas/${ID_RESERVA_NUEVA}$`));
  await expect(titulo(page)).toContainText('Reserva 8');
  await expect(titulo(page)).toContainText('Reservada');
});

test('cobrar la seña hace el recibo, y el recibo se abre', async ({ page, esTelefono }) => {
  await page.goto(`/alquileres/reservas/${IDS.reserva2}`);
  await expect(titulo(page)).toContainText('Reserva 7');
  await revisarEnTelefono(page, esTelefono, 'la ficha de la reserva');

  const cobrar = page.getByRole('button', { name: '💵 Cobrar la seña' });
  await esTocable(cobrar);
  await cobrar.click();
  const dialogo = page.getByRole('dialog', { name: 'Cobrar la seña de $ 300.000,00' });
  await expect(dialogo.getByLabel(/^Fecha/)).not.toHaveValue('');
  await revisarModal(page, dialogo, esTelefono);

  const confirmar = dialogo.getByRole('button', { name: 'Cobrar y hacer el recibo' });
  await esTocable(confirmar);
  const pedido = await confirmarYRecargar(page, confirmar, '/sena');
  expect(pedido.postDataJSON()).toMatchObject({
    medio: 'transferencia',
    personaId: IDS.inquilino,
  });

  // Ya cobrada: el botón de cobrar se va y aparece el recibo.
  await expect(titulo(page)).toContainText('Reserva 7');
  await expect(cobrar).toHaveCount(0);
  const recibo = page.getByRole('button', { name: '🧾 Recibo 000124' });
  await esTocable(recibo);
  const pestana = page.context().waitForEvent('page');
  const pidePdf = page.waitForRequest(
    (r) => r.url().includes('/alquileres/cobros/') && r.url().endsWith('/recibo'),
  );
  await recibo.click();
  await pidePdf;
  await (await pestana).close();
});

test('el estudio de garantías y la aprobación cambian el estado y habilitan convertirla', async ({
  page,
  esTelefono,
}) => {
  await page.goto(`/alquileres/reservas/${IDS.reserva2}`);
  await expect(page.getByRole('link', { name: '📄 Convertir en contrato' })).toHaveCount(0);

  await page.getByRole('button', { name: '🔎 Empezar el estudio de garantías' }).click();
  let dialogo = page.getByRole('dialog', { name: 'Empezar el estudio de garantías' });
  await revisarModal(page, dialogo, esTelefono);
  await confirmarYRecargar(
    page,
    dialogo.getByRole('button', { name: 'Empezar', exact: true }),
    '/estado',
  );
  await expect(titulo(page)).toContainText('En estudio de garantías');

  await page.getByRole('button', { name: '✅ Aprobar' }).click();
  dialogo = page.getByRole('dialog', { name: 'Aprobar la reserva' });
  await confirmarYRecargar(
    page,
    dialogo.getByRole('button', { name: 'Aprobar', exact: true }),
    '/estado',
  );
  await expect(titulo(page)).toContainText('Aprobada');
  await esTocable(page.getByRole('link', { name: '📄 Convertir en contrato' }));
});

test('convertir una reserva aprobada abre el alta del contrato con todo precargado', async ({
  page,
  esTelefono,
}) => {
  await page.goto(`/alquileres/reservas/${IDS.reserva}`);
  await page.getByRole('link', { name: '📄 Convertir en contrato' }).click();
  await expect(page).toHaveURL(new RegExp(`/alquileres/reservas/${IDS.reserva}/convertir$`));
  await expect(page.getByText('Contrato desde la reserva 6')).toBeVisible();

  // Partes: la propiedad y las personas de la reserva.
  await expect(page.getByLabel(/^Propiedad/)).toHaveValue(IDS.propiedad);
  await expect(page.getByLabel('Persona (inquilino)')).toHaveValue(IDS.inquilino);
  await expect(page.getByLabel('Persona (propietario)')).toHaveValue(IDS.propietario);
  await revisarEnTelefono(page, esTelefono, 'el contrato desde la reserva');

  // Condiciones: del 1/11/2026 por 24 meses; la seña cobrada pasa a ser el depósito.
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(page.getByLabel(/^Inicio/)).toHaveValue('2026-11-01');
  await expect(page.getByLabel(/^Fin/)).toHaveValue('2028-10-31');
  await expect(
    page.getByText('La seña de $ 900.000,00 pasa a ser el depósito: ya está cobrado.'),
  ).toBeVisible();

  // Tramos: el primero con el alquiler inicial.
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(page.getByLabel('Importe, tramo 1')).toHaveValue('900.000,00');
  await revisarEnTelefono(page, esTelefono, 'los tramos desde la reserva');

  const guardar = page.getByRole('button', { name: 'Guardar en borrador' });
  await esTocable(guardar);
  const pedido = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/convertir'),
  );
  await guardar.click();
  const body = (await pedido).postDataJSON() as { propiedadId: string; inicio: string };
  expect(body).toMatchObject({ propiedadId: IDS.propiedad, inicio: '2026-11-01' });
  await expect(page).toHaveURL(new RegExp(`/alquileres/contratos/${IDS.contrato}$`));
});

test('cerrar «No se presentó a firmar» retiene la seña para el propietario', async ({
  page,
  esTelefono,
}) => {
  await page.goto(`/alquileres/reservas/${IDS.reserva}`);
  const cerrar = page.getByRole('button', { name: 'No se presentó a firmar' });
  await esTocable(cerrar);
  await cerrar.click();

  const dialogo = page.getByRole('dialog', { name: 'El interesado no se presentó a firmar' });
  await expect(dialogo).toContainText(
    'La seña de $ 900.000,00 se retiene y se le entrega a Carlos Gómez en su próxima liquidación.',
  );
  await revisarModal(page, dialogo, esTelefono);
  const pedido = await confirmarYRecargar(
    page,
    dialogo.getByRole('button', { name: 'Cerrar la reserva' }),
    '/estado',
  );
  expect(pedido.postDataJSON()).toEqual({ estado: 'no_se_presento' });

  await expect(titulo(page)).toContainText('No se presentó a firmar');
  await expect(page.getByRole('status').filter({ hasText: 'Seña retenida:' })).toContainText(
    '$ 900.000,00 se le entrega al propietario en su próxima liquidación.',
  );
  // Cerrada: ya no se convierte ni se edita.
  await expect(page.getByRole('link', { name: '📄 Convertir en contrato' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '✏️ Editar' })).toHaveCount(0);
});
