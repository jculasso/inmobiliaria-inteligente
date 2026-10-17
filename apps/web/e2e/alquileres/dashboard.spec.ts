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
  // Los anticipados de otras tarjetas (regla 190) pueden salir en este rato; la deuda, no.
  let pidio = false;
  page.on('request', (r) => {
    if (r.url().includes('/alquileres/tablero/detalle') && r.url().includes('indicador=mora'))
      pidio = true;
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

/** Los pedidos de listas del Dashboard (regla 79), desde antes de abrir la página. */
function pedidosDeListas(page: Page) {
  const urls: URL[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/alquileres/tablero/detalle')) urls.push(new URL(r.url()));
  });
  return {
    urls,
    de: (indicador: string, desde: string, hasta = desde) =>
      urls.filter(
        (u) =>
          u.searchParams.get('indicador') === indicador &&
          u.searchParams.get('desde') === desde &&
          u.searchParams.get('hasta') === hasta,
      ).length,
  };
}

test('reglas 79 y 190: la cartera de un mes cerrado pide su lista en segundo plano, abrirla no la pide otra vez, y la lista se lee en el teléfono', async ({
  page,
  esTelefono,
}) => {
  const pedidos = pedidosDeListas(page);
  await page.goto('/alquileres?periodo=mes&mes=9');
  const tarjeta = page.getByRole('button', { name: /^Cartera: 2\. Ver el detalle/ });
  await expect(tarjeta).toContainText('al 30/09/2026');
  // No viaja con el tablero: se pide apenas la tarjeta está a la vista.
  await expect.poll(() => pedidos.de('vigentes', '2026-09')).toBe(1);
  await page.waitForLoadState('networkidle');
  await esTocable(tarjeta);
  await tarjeta.click();

  const dialogo = page.getByRole('dialog', { name: 'Contratos vigentes al 30/09/2026' });
  await expect(dialogo.getByText('ALT-0001').filter({ visible: true }).first()).toBeVisible();
  await expect(dialogo.getByText('ALT-0002').filter({ visible: true }).first()).toBeVisible();
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);
  expect(pedidos.de('vigentes', '2026-09')).toBe(1);
});

test('reglas 189 y 190: después de pintar, tocar «Ingresos de octubre» no pide nada si el anticipado ya llegó: la lista se ve en el acto', async ({
  page,
  esTelefono,
}) => {
  const pedidos = pedidosDeListas(page);
  const anticipado = page.waitForResponse(
    (r) =>
      r.url().includes('/alquileres/tablero/detalle') &&
      r.url().includes('indicador=ingresos') &&
      r.url().includes('desde=2026-10&hasta=2026-10'),
  );
  await page.goto('/alquileres');
  expect((await anticipado).ok()).toBe(true);
  await page.waitForLoadState('networkidle');
  const antes = pedidos.urls.length;

  const tarjeta = page.getByRole('button', { name: /^Ingresos de octubre: / });
  await esTocable(tarjeta);
  await tarjeta.click();
  const dialogo = page.getByRole('dialog', { name: 'Ingresos de la inmobiliaria, octubre' });
  await expect(dialogo).toBeVisible();
  // La lista ya está: ni un cuadro de «Cargando la lista…».
  await expect(dialogo.getByText('Cargando la lista…')).toHaveCount(0);
  await expect(
    dialogo.getByText('Alquiler — ingresos').filter({ visible: true }).first(),
  ).toBeVisible();
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);

  // Y abrirla otra vez tampoco pide nada (regla 189).
  await tarjeta.click();
  await expect(
    dialogo.getByText('Alquiler — ingresos').filter({ visible: true }).first(),
  ).toBeVisible();
  await cerrarModal(dialogo);
  expect(pedidos.urls.length).toBe(antes);
  expect(pedidos.de('ingresos', '2026-10')).toBe(1);
});

test('regla 187: la lista de «Cobranza de octubre» muestra lo cobrado y lo que falta, con sus totales, primero los que deben', async ({
  page,
  esTelefono,
}) => {
  const pedidos = pedidosDeListas(page);
  await page.goto('/alquileres');
  const tarjeta = page.getByRole('button', { name: /^Cobranza de octubre: 41%/ });
  await expect(tarjeta).toContainText('1 de 2 pagaron · 1 atrasado');
  await esTocable(tarjeta);
  await tarjeta.click();

  const dialogo = page.getByRole('dialog', { name: 'Cobranza de octubre' });
  await expect(
    dialogo.getByText('Cobrado $ 850.000,00 de $ 2.050.000,00 (41%) · 1 sin pagar'),
  ).toBeVisible();
  if (esTelefono) {
    // Cada tarjeta de la lista muestra el alquiler, lo cobrado y lo que falta.
    const tarjetas = dialogo.getByRole('listitem').filter({ visible: true });
    await expect(tarjetas.first()).toContainText('Panadería El Trigal SRL');
    await expect(tarjetas.first()).toContainText('Alquiler$ 1.200.000,00');
    await expect(tarjetas.first()).toContainText('Cobrado$ 0,00');
    await expect(tarjetas.first()).toContainText('Falta$ 1.200.000,00');
    await expect(tarjetas.nth(1)).toContainText('Lucía Fernández');
    const totales = dialogo.getByLabel('Totales');
    await expect(totales).toBeVisible();
    await expect(totales).toContainText('Total alquiler$ 2.050.000,00');
    await expect(totales).toContainText('Total cobrado$ 850.000,00');
    await expect(totales).toContainText('Total falta$ 1.200.000,00');
  } else {
    const tabla = dialogo.getByRole('table');
    await expect(tabla.getByRole('columnheader')).toHaveText([
      'Inquilino',
      'Propiedad',
      'Contrato',
      'Vence',
      'Alquiler',
      'Cobrado',
      'Falta',
      'Estado',
    ]);
    const filas = tabla.getByRole('row');
    await expect(filas.nth(1)).toContainText('Panadería El Trigal SRL');
    await expect(filas.nth(2)).toContainText('Lucía Fernández');
    await expect(filas.last()).toHaveText(
      /^Total\s*\$ 2\.050\.000,00\s*\$ 850\.000,00\s*\$ 1\.200\.000,00\s*$/,
    );
  }
  await revisarModal(page, dialogo, esTelefono);
  await cerrarModal(dialogo);
  // Se arma con lo que viaja con el tablero: no pide ninguna lista de cobranza.
  expect(pedidos.urls.filter((u) => /emitid|cobrad/i.test(u.search))).toEqual([]);
});

test('regla 188: «Cobrado dentro del mes» abre la cuenta mes por mes, y un mes abre sus alquileres', async ({
  page,
  esTelefono,
}) => {
  await page.goto('/alquileres');
  const tarjeta = page.getByRole('button', { name: /^Cobrado dentro del mes: \d+%/ });
  const porcentaje = (await tarjeta.getAttribute('aria-label'))!.match(/: (\d+%)/)![1]!;
  await esTocable(tarjeta);
  await tarjeta.click();
  const dialogo = page.getByRole('dialog', { name: 'Cobrado dentro del mes, 2026' });
  // El total es el de la tarjeta (regla 76).
  if (esTelefono) await expect(dialogo.getByLabel('Total')).toContainText(`Total${porcentaje}`);
  else
    await expect(dialogo.getByRole('row').last()).toHaveText(new RegExp(`^Total.*${porcentaje}$`));
  await expect(dialogo.getByText('· en curso').filter({ visible: true })).toBeVisible();
  await revisarModal(page, dialogo, esTelefono);

  await dialogo
    .getByRole('button', { name: /^Septiembre/ })
    .filter({ visible: true })
    .click();
  const mes = page.getByRole('dialog', { name: 'Alquileres emitidos de septiembre 2026' });
  await expect(mes.getByText('ALT-0002').filter({ visible: true }).first()).toBeVisible();
  await mes.getByRole('button', { name: '← Mes por mes' }).click();
  await expect(dialogo).toBeVisible();
  await cerrarModal(dialogo);
});
