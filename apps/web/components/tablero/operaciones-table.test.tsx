import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LIMITE_LISTA, LIMITE_LISTA_CON_SONDA, type OperacionDto } from '@vacker/types';
import { OperacionesTable } from './operaciones-table';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  // Los usa el encabezado ordenable, que vive dentro de esta tabla.
  usePathname: () => '/tablero/ventas',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
const deleteOperacion = vi.fn().mockResolvedValue({ id: '1' });
const getOperacion = vi.fn();
const updateOperacion = vi.fn().mockResolvedValue({ id: '1' });
vi.mock('../../lib/tablero-api', () => ({
  deleteOperacion: (...args: unknown[]) => deleteOperacion(...args),
  getOperacion: (...args: unknown[]) => getOperacion(...args),
  // Los usa el formulario de edición, que se abre desde esta tabla.
  updateOperacion: (...args: unknown[]) => updateOperacion(...args),
  createOperacion: vi.fn(),
}));

const OPERACIONES: OperacionDto[] = [
  {
    id: '1',
    codigo: 'OP-1001',
    tipo: 'venta',
    direccion: 'Av. Siempre Viva 742',
    precio: 100000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 1,
    comTotal: 3000,
    estado: 'escriturada',
    fechaReserva: null,
    fechaFirma: '2026-03-10',
    anio: 2026,
    mes: 3,
    obs: null,
    puntas: [{ id: 'p1', lado: 'vendedora', usuarioId: 'u1', nombre: 'Ana', comision: 3000 }],
  },
  {
    id: '2',
    codigo: 'OP-1002',
    tipo: 'venta',
    direccion: 'Calle Falsa 123',
    precio: 80000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 1,
    comTotal: 2000,
    estado: 'senada',
    fechaReserva: '2026-04-01',
    fechaFirma: null,
    anio: 2026,
    mes: 4,
    obs: null,
    puntas: [{ id: 'p2', lado: 'compradora', usuarioId: 'u2', nombre: 'Beto', comision: 2000 }],
  },
];

// El componente dibuja las mismas operaciones dos veces: tabla en pantalla
// ancha y tarjetas en el celular (cuál se ve lo decide el CSS, que jsdom no
// aplica). Los tests dicen explícitamente qué vista miran.
const enLaTabla = () => within(screen.getByRole('table'));
const enLasTarjetas = () => within(screen.getByRole('list', { name: 'Operaciones' }));

beforeEach(() => {
  // Por defecto, el detalle es la misma operación de la lista.
  getOperacion.mockReset();
  getOperacion.mockImplementation(async (_token: string, id: string) =>
    OPERACIONES.find((o) => o.id === id),
  );
  updateOperacion.mockClear();
  deleteOperacion.mockClear();
});

describe('OperacionesTable', () => {
  it('muestra las operaciones y el contador', () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(enLaTabla().getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(enLaTabla().getByText('Calle Falsa 123')).toBeInTheDocument();
    // Sin filtro, el total solo (como el resto de las listas: `BarraLista`).
    expect(screen.getByText('2 operaciones')).toBeInTheDocument();
  });

  it('el estado va en una insignia: lo cerrado verde, lo en curso ámbar, nunca el color de la marca', () => {
    // La seña iba en `brand-red`: con una marca verde se veía igual que una
    // escritura, y en la roja de Vacker parecía un error (CONVENCIONES §13).
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(enLaTabla().getByText('Escriturada')).toHaveClass('text-success');
    const senada = enLaTabla().getByText('Señada');
    expect(senada).toHaveClass('text-warning');
    expect(senada.className).not.toMatch(/brand-red/);
  });

  it('la fecha de firma se lee como fecha, no como el ISO de la base', () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(enLaTabla().getByText('10/03/2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-03-10')).not.toBeInTheDocument();
  });

  it('los botones de cada fila dicen de qué operación son', () => {
    // Un lector de pantalla leía «Borrar, Borrar, Borrar…» sin decir cuál.
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(
      enLaTabla().getByRole('button', { name: 'Borrar la venta OP-1001 (Av. Siempre Viva 742)' }),
    ).toBeInTheDocument();
    expect(
      enLaTabla().getByRole('button', { name: 'Editar la venta OP-1002 (Calle Falsa 123)' }),
    ).toBeInTheDocument();
  });

  it('en el celular cada operación es una tarjeta, sin tabla que deslizar', () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(enLasTarjetas().getAllByRole('listitem')).toHaveLength(2);
    expect(enLasTarjetas().getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    // El precio y la comisión se ven de una: antes había que deslizar a ciegas.
    expect(enLasTarjetas().getByText('U$S 100.000')).toBeInTheDocument();
    expect(enLasTarjetas().getByText('U$S 3.000')).toBeInTheDocument();
  });

  it('filtra por texto de búsqueda', async () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );
    await userEvent.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'Ana');
    expect(enLaTabla().getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.queryByText('Calle Falsa 123')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 2 operaciones')).toBeInTheDocument();
  });

  // El vendedor y el team leader entran acá en modo lectura: ven sus
  // operaciones (las necesitan para sus KPIs) pero no las tocan. Se verifican
  // las TRES acciones, no solo el borrado: ocultar una y olvidar otra deja un
  // botón que promete algo que la API va a rechazar con un 403.
  it('sin permiso de escritura no hay alta, edición ni borrado', () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(screen.queryByRole('button', { name: /Nueva venta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Borrar/ })).not.toBeInTheDocument();
  });

  it('con permiso de escritura están las tres', () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(screen.getByRole('button', { name: /Nueva venta/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Editar/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Borrar/ }).length).toBeGreaterThan(0);
  });

  it('antes de borrar muestra qué operación es, para no equivocarse', async () => {
    // El implementador va a depurar ventas reales y el borrado es definitivo:
    // tiene que poder confirmar que está mirando la operación correcta.
    const user = userEvent.setup();
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );

    await user.click(enLaTabla().getAllByRole('button', { name: /Borrar/ })[0]!);

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Borrar venta')).toBeInTheDocument();
    expect(within(dialogo).getByText('OP-1001')).toBeInTheDocument();
    expect(within(dialogo).getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(within(dialogo).getByText('U$S 100.000')).toBeInTheDocument();
    expect(within(dialogo).getByText('Ana')).toBeInTheDocument();
  });

  it('avisa cuando la lista quedó recortada, en vez de mostrar 500 en silencio', () => {
    // El tope existía desde siempre pero era MUDO: alguien con 1.240
    // operaciones veía 500 y decidía con datos incompletos sin enterarse.
    const muchas = Array.from({ length: LIMITE_LISTA_CON_SONDA }, (_, i) => ({
      ...OPERACIONES[0]!,
      id: `op-${i}`,
      codigo: `OP-${i}`,
    }));
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={muchas}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="desc"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      `Se están mostrando ${LIMITE_LISTA} ventas, y hay más`,
    );
    // Y se muestra el tope exacto, no la fila de sonda.
    expect(enLaTabla().getAllByRole('row')).toHaveLength(LIMITE_LISTA + 1); // + encabezado
    // Dibuja 501 filas dos veces (tabla + tarjetas): con los 5s por defecto se
    // pasaba de tiempo cuando corre en paralelo con el resto de los paquetes,
    // y fallaba de forma intermitente sin que hubiera nada roto.
  }, 20_000);

  it('con pocas operaciones no avisa nada', () => {
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="desc"
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('borra recién cuando se confirma en el modal', async () => {
    const user = userEvent.setup();
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );

    await user.click(enLaTabla().getAllByRole('button', { name: /Borrar/ })[0]!);
    expect(deleteOperacion).not.toHaveBeenCalled();

    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, borrar' }),
    );
    expect(deleteOperacion).toHaveBeenCalledWith('token', '1');
  });
});

/**
 * Editar una venta compartida desde «lo mío» borraba la punta del otro
 * vendedor (revisión de seguridad del 17/10/2026, H1).
 *
 * Dirección sin «Ver todo» recibe la lista enmascarada: una venta compartida
 * llega con su punta sola. Editar abría el formulario con esa fila, y al
 * guardar viajaban las puntas visibles como el set completo: la punta ajena y
 * su comisión desaparecían aunque solo se hubiera tocado el estado. Ahora
 * Editar y Borrar piden el detalle, que a quien escribe no le oculta nada.
 */
describe('OperacionesTable — editar y borrar con la venta completa', () => {
  const VENDEDORES = [
    { id: 'u1', nombre: 'Ana' },
    { id: 'u2', nombre: 'Beto' },
  ] as never;

  /** Como llega en la lista a Ana (dirección) en «lo mío»: su punta sola. */
  const EN_LA_LISTA: OperacionDto = {
    id: '3',
    codigo: 'OP-1003',
    tipo: 'venta',
    direccion: 'Pasaje Compartido 50',
    precio: 200000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 2,
    comTotal: 5000,
    estado: 'escriturada',
    fechaReserva: null,
    fechaFirma: '2026-05-10',
    anio: 2026,
    mes: 5,
    obs: null,
    puntas: [{ id: 'p1', lado: 'vendedora', usuarioId: 'u1', nombre: 'Ana', comision: 5000 }],
  };

  /** Lo que devuelve el detalle: las dos puntas y la comisión entera. */
  const COMPLETA: OperacionDto = {
    ...EN_LA_LISTA,
    comTotal: 8000,
    puntas: [
      ...EN_LA_LISTA.puntas,
      { id: 'p2', lado: 'compradora', usuarioId: 'u2', nombre: 'Beto', comision: 3000 },
    ],
  };

  function renderCompartida() {
    getOperacion.mockResolvedValue(COMPLETA);
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={[EN_LA_LISTA]}
        vendedores={VENDEDORES}
        puedeEscribir={true}
        orden="codigo"
        dir="desc"
      />,
    );
  }

  const botonEditar = () =>
    enLaTabla().getByRole('button', { name: 'Editar la venta OP-1003 (Pasaje Compartido 50)' });
  const botonBorrar = () =>
    enLaTabla().getByRole('button', { name: 'Borrar la venta OP-1003 (Pasaje Compartido 50)' });

  it('Editar pide la venta completa, y el formulario muestra las dos puntas', async () => {
    const user = userEvent.setup();
    renderCompartida();

    await user.click(botonEditar());

    const dialogo = await screen.findByRole('dialog');
    expect(getOperacion).toHaveBeenCalledWith('token', '3');
    expect(within(dialogo).getByDisplayValue('Ana')).toBeInTheDocument();
    expect(within(dialogo).getByDisplayValue('Beto')).toBeInTheDocument();
    expect(
      within(dialogo).getByRole('textbox', { name: 'Comisión de la punta compradora' }),
    ).toHaveValue('3.000,00');
  });

  it('al guardar sin tocar las puntas, la del otro vendedor sigue viajando', async () => {
    const user = userEvent.setup();
    renderCompartida();

    await user.click(botonEditar());
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    expect(updateOperacion).toHaveBeenCalledTimes(1);
    const [, id, dto] = updateOperacion.mock.calls[0]!;
    expect(id).toBe('3');
    expect(dto.puntas).toEqual([
      { lado: 'vendedora', usuarioId: 'u1', comision: 5000 },
      { lado: 'compradora', usuarioId: 'u2', comision: 3000 },
    ]);
    expect(dto.puntasVistas).toEqual(['p1', 'p2']);
  });

  it('la confirmación de borrado lista a los dos vendedores y la comisión entera', async () => {
    const user = userEvent.setup();
    renderCompartida();

    await user.click(botonBorrar());

    const dialogo = await screen.findByRole('dialog');
    expect(getOperacion).toHaveBeenCalledWith('token', '3');
    expect(within(dialogo).getByText('Ana · Beto')).toBeInTheDocument();
    expect(within(dialogo).getByText('U$S 8.000')).toBeInTheDocument();
  });

  it('mientras pide la venta, el botón muestra que está cargando', async () => {
    const user = userEvent.setup();
    renderCompartida();
    let soltar: (op: OperacionDto) => void = () => {};
    getOperacion.mockReturnValueOnce(new Promise((resolve) => (soltar = resolve)));

    await user.click(botonEditar());

    expect(botonEditar()).toHaveAttribute('aria-busy', 'true');
    expect(botonEditar()).toHaveAttribute('title', 'Abriendo…');
    // En la tarjeta del teléfono, con texto.
    expect(enLasTarjetas().getByRole('button', { name: '⏳ Abriendo…' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    soltar(COMPLETA);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(botonEditar()).not.toHaveAttribute('aria-busy');
  });

  it('si la venta no llega, avisa y no abre el formulario', async () => {
    const user = userEvent.setup();
    renderCompartida();
    getOperacion.mockRejectedValueOnce(
      new Error('No hay conexión con el servidor. Revisá internet y probá de nuevo.'),
    );

    await user.click(botonEditar());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo abrir la venta OP-1003 (Pasaje Compartido 50) para editarla. No hay conexión con el servidor.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botonEditar()).not.toHaveAttribute('aria-busy');
  });
});

describe('OperacionesTable — ordenar sin ir al servidor', () => {
  /** Códigos en el orden en que aparecen en la tabla de escritorio. */
  function codigosEnPantalla() {
    return enLaTabla()
      .getAllByRole('row')
      .slice(1) // saltea el encabezado
      .map((fila) => fila.querySelector('td')?.textContent ?? '');
  }

  it('al hacer click en Código invierte el orden en la pantalla', async () => {
    // La lista viene completa (2 filas, muy lejos del tope), así que reordenar
    // no necesita consultar: es el caso normal de Vacker con 87 ventas.
    const user = userEvent.setup();
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="asc"
      />,
    );
    expect(codigosEnPantalla()).toEqual(['OP-1001', 'OP-1002']);

    await user.click(enLaTabla().getByRole('button', { name: /Ordenar por Código/ }));

    // 1002 tiene el número más alto: pasa a estar primero.
    expect(codigosEnPantalla()).toEqual(['OP-1002', 'OP-1001']);
  });

  it('al ordenar por Firma, la que no tiene fecha queda al final', async () => {
    const user = userEvent.setup();
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="asc"
      />,
    );

    await user.click(enLaTabla().getByRole('button', { name: /Ordenar por Firma/ }));

    // OP-1002 no tiene fecha de firma: va última en descendente...
    expect(codigosEnPantalla()).toEqual(['OP-1001', 'OP-1002']);

    await user.click(enLaTabla().getByRole('button', { name: /Ordenar por Firma/ }));

    // ...y también en ascendente, que es el caso que se olvida.
    expect(codigosEnPantalla()).toEqual(['OP-1001', 'OP-1002']);
  });

  it('la búsqueda por texto respeta el orden elegido', async () => {
    const user = userEvent.setup();
    render(
      <OperacionesTable
        tipo="venta"
        operaciones={OPERACIONES}
        vendedores={[]}
        puedeEscribir={false}
        orden="codigo"
        dir="asc"
      />,
    );

    await user.click(enLaTabla().getByRole('button', { name: /Ordenar por Código/ }));
    await user.type(screen.getByPlaceholderText(/Buscar/), 'a');

    // Filtrar no puede devolver la tabla al orden original.
    expect(codigosEnPantalla()).toEqual(['OP-1002', 'OP-1001']);
  });
});
