import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResumenAcumulado } from './resumen-acumulado';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

/** El filtro con el que se abrió la ventana de detalle, para poder afirmarlo. */
const filtrosDelDetalle: unknown[] = [];
vi.mock('./detalle-drill-modal', () => ({
  DetalleDrillModal: ({ titulo, filtro }: { titulo: string; filtro: unknown }) => {
    filtrosDelDetalle.push(filtro);
    return <div data-testid="detalle">{titulo}</div>;
  },
}));

const getResumenPeriodo = vi.fn().mockResolvedValue({
  agregado: {
    volumen: 1000,
    operaciones: 2,
    puntas: 2,
    puntasCompradoras: 1,
    puntasVendedoras: 1,
    comision: 50,
    comisionCompradora: 0,
    comisionVendedora: 50,
    ticketPromedio: 500,
  },
  ranking: [
    {
      usuarioId: 'a',
      nombre: 'Ana',
      volumen: 800,
      operaciones: 2,
      puntas: 2,
      puntasCompradoras: 1,
      puntasVendedoras: 1,
      ticketPromedio: 500,
      comision: 50,
      comisionCompradora: 0,
      comisionVendedora: 50,
      peso: 1,
    },
  ],
});
const getAgregadosPorTrimestre = vi.fn().mockResolvedValue([
  { volumen: 100, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, comision: 5, comisionCompradora: 0, comisionVendedora: 5, ticketPromedio: 100 },
  { volumen: 200, operaciones: 1, puntas: 1, puntasCompradoras: 1, puntasVendedoras: 0, comision: 10, comisionCompradora: 0, comisionVendedora: 10, ticketPromedio: 200 },
  { volumen: 0, operaciones: 0, puntas: 0, puntasCompradoras: 0, puntasVendedoras: 0, comision: 0, comisionCompradora: 0, comisionVendedora: 0, ticketPromedio: 0 },
  { volumen: 0, operaciones: 0, puntas: 0, puntasCompradoras: 0, puntasVendedoras: 0, comision: 0, comisionCompradora: 0, comisionVendedora: 0, ticketPromedio: 0 },
]);
/** Doce meses con volúmenes distintos, para que un error de índice se vea. */
const getKpisMensual = vi.fn().mockResolvedValue(
  Array.from({ length: 12 }, (_, i) => ({
    volumen: (i + 1) * 100,
    operaciones: i + 1,
    puntas: i + 1,
    puntasCompradoras: 0,
    puntasVendedoras: i + 1,
    comision: (i + 1) * 5,
    comisionCompradora: 0,
    comisionVendedora: (i + 1) * 5,
    ticketPromedio: 100,
  })),
);
vi.mock('../../lib/tablero-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tablero-api')>();
  return {
    ...actual,
    getResumenPeriodo: (...args: unknown[]) => getResumenPeriodo(...args),
    getAgregadosPorTrimestre: (...args: unknown[]) => getAgregadosPorTrimestre(...args),
    getKpisMensual: (...args: unknown[]) => getKpisMensual(...args),
  };
});

describe('ResumenAcumulado', () => {
  it('carga el tab Anual por default y muestra las métricas', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    expect(await screen.findByText('$1.000')).toBeInTheDocument();
    expect(getResumenPeriodo).toHaveBeenCalledWith('token', {
      anio: 2026,
      periodo: 'anual',
      mes: 7,
      trimestre: 3,
    });
  });

  it('al elegir Trimestral aparecen los sub-tabs Q1-Q4 y se puede cambiar de trimestre', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await screen.findByText('$1.000');

    await userEvent.click(screen.getByRole('button', { name: /Acumulado Trimestral/ }));
    expect(await screen.findByRole('button', { name: /Q1 · Ene–Mar/ })).toBeInTheDocument();
    /*
     * «Volumen USD» aparece DOS veces desde que el trimestral tiene tabla: en
     * la leyenda del gráfico y como fila del cuadro. Se comprueban las dos, que
     * es justamente lo que tiene que estar.
     */
    expect(await screen.findAllByText('Volumen USD')).toHaveLength(2);
    // Y el cuadro, por una fila que solo existe ahí.
    expect(screen.getByText('Total comisión')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Q1 · Ene–Mar/ }));
    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'trimestral',
      mes: 7,
      trimestre: 1,
    });
  });
});

/**
 * El cuarto pedido de Vacker: ver QUÉ operaciones hay detrás del número.
 *
 * El filtro tiene que traer las cuatro cosas. Si se le cae `estado`, la lista
 * trae también las señadas —que la tarjeta nunca contó, porque el agregado sale
 * de `ventas(tx, anio, 'escriturada')`— y el detalle deja de coincidir con el
 * número sobre el que se hizo click. Es el mismo error que ya apareció una vez
 * en el detalle del ranking.
 */
describe('ResumenAcumulado — las operaciones del trimestre', () => {
  it('al hacer click en Operaciones abre el detalle de ESE trimestre', async () => {
    filtrosDelDetalle.length = 0;
    render(<ResumenAcumulado anio={2026} mesSeleccionado={8} verTodo />);

    await userEvent.click(screen.getByRole('button', { name: /Acumulado Trimestral/ }));
    await screen.findByRole('button', { name: /Q1 · Ene–Mar/ });
    await userEvent.click(screen.getByRole('button', { name: /Q2 · Abr–Jun/ }));

    await userEvent.click(await screen.findByRole('button', { name: /Operaciones/ }));

    expect(screen.getByTestId('detalle')).toHaveTextContent('Q2');
    expect(filtrosDelDetalle.at(-1)).toEqual({
      anio: 2026,
      trimestre: 2,
      tipo: 'venta',
      estado: 'escriturada',
      verTodo: true,
    });
  });

  it('en el acumulado anual, la tarjeta de Operaciones no abre nada', () => {
    // En el acumulado anual no hay trimestre que mirar: la tarjeta no es un botón.
    filtrosDelDetalle.length = 0;
    render(<ResumenAcumulado anio={2026} mesSeleccionado={8} />);
    expect(screen.queryByRole('button', { name: /Operaciones/ })).not.toBeInTheDocument();
  });
});

/**
 * El pedido de Vacker del 25/09/2026: «que se vea como el acumulado
 * trimestral, pero en vez de los Q que figuren los meses del año natural».
 */
describe('ResumenAcumulado — el acumulado mensual', () => {
  it('muestra el cuadro con las doce columnas de meses', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await userEvent.click(screen.getByRole('button', { name: /Acumulado del Mes/ }));

    const tabla = await screen.findByRole('table', { name: 'Ventas por período' });
    const encabezados = within(tabla)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(encabezados).toEqual(['Métrica', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Total']);
  });

  /*
   * Cada mes en SU columna. El total no alcanza para detectarlo: si los meses
   * se corrieran una columna, la suma seguiría dando lo mismo y enero mostraría
   * los números de febrero. Pasó en un sabotaje antes de agregar este test.
   */
  it('cada mes va en su columna', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await userEvent.click(screen.getByRole('button', { name: /Acumulado del Mes/ }));
    const tabla = await screen.findByRole('table', { name: 'Ventas por período' });
    const volumen = within(within(tabla).getByRole('row', { name: /^Volumen USD/ }))
      .getAllByRole('cell')
      .slice(1, 13)
      .map((c) => c.textContent);
    expect(volumen).toEqual(['$100', '$200', '$300', '$400', '$500', '$600', '$700', '$800', '$900', '$1.000', '$1.100', '$1.200']);
  });

  /*
   * Los doce meses tienen que cerrar en el año. Si un mes se perdiera, el
   * total dejaría de coincidir con el anual.
   */
  it('el total de los meses es la suma de los doce', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await userEvent.click(screen.getByRole('button', { name: /Acumulado del Mes/ }));
    const tabla = await screen.findByRole('table', { name: 'Ventas por período' });
    const volumen = within(within(tabla).getByRole('row', { name: /^Volumen USD/ })).getAllByRole('cell');
    // 100 + 200 + … + 1200 = 7.800
    expect(volumen.at(-1)?.textContent).toBe('$7.800');
  });

  it('marca el mes seleccionado arriba y pide el resumen de ese mes', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await userEvent.click(screen.getByRole('button', { name: /Acumulado del Mes/ }));
    const tabla = await screen.findByRole('table', { name: 'Ventas por período' });
    expect(within(tabla).getByRole('columnheader', { name: 'Jul' })).toHaveAttribute('aria-current', 'true');
    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'mensual',
      mes: 7,
      trimestre: 3,
    });
  });

  it('al hacer click en Operaciones abre las de ESE mes', async () => {
    filtrosDelDetalle.length = 0;
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} verTodo />);
    await userEvent.click(screen.getByRole('button', { name: /Acumulado del Mes/ }));
    const tabla = await screen.findByRole('table', { name: 'Ventas por período' });
    await userEvent.click(within(tabla).getByRole('button', { name: 'Mar' }));

    await userEvent.click(await screen.findByRole('button', { name: /Operaciones/ }));
    expect(screen.getByTestId('detalle')).toHaveTextContent('Marzo');
    expect(filtrosDelDetalle.at(-1)).toEqual({
      anio: 2026,
      mes: 3,
      tipo: 'venta',
      estado: 'escriturada',
      verTodo: true,
    });
  });
});

/**
 * La tabla de totales por vendedor NO vive acá. Vivió acá hasta el 26/09/2026,
 * y al mismo tiempo existía el «Ranking de vendedores» con el mismo dato: dos
 * tablas iguales. Ahora hay una sola, en `TotalesVendedores`, con su propio
 * selector. Si alguien la vuelve a poner dentro del Resumen, reaparece el
 * duplicado — este test lo frena.
 */
describe('ResumenAcumulado — la tabla de totales vive en su propia sección', () => {
  it('no muestra los totales por vendedor en ninguna pestaña', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await screen.findByText('$1.000');
    for (const pestaña of [/Acumulado Anual/, /Acumulado Trimestral/, /Acumulado del Mes/]) {
      await userEvent.click(screen.getByRole('button', { name: pestaña }));
      expect(screen.queryByText(/Totales por vendedor/)).not.toBeInTheDocument();
      expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    }
  });
});
