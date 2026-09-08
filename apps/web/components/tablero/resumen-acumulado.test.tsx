import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
vi.mock('../../lib/tablero-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tablero-api')>();
  return {
    ...actual,
    getResumenPeriodo: (...args: unknown[]) => getResumenPeriodo(...args),
    getAgregadosPorTrimestre: (...args: unknown[]) => getAgregadosPorTrimestre(...args),
  };
});

describe('ResumenAcumulado', () => {
  it('carga el tab Anual por default y muestra las métricas + totales por vendedor', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    expect(await screen.findByText('$1.000')).toBeInTheDocument();
    expect(screen.getAllByText('Ana')[0]).toBeInTheDocument();
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

  it('fuera del trimestral, la tarjeta de Operaciones no abre nada', () => {
    // En el acumulado anual no hay trimestre que mirar: la tarjeta no es un botón.
    filtrosDelDetalle.length = 0;
    render(<ResumenAcumulado anio={2026} mesSeleccionado={8} />);
    expect(screen.queryByRole('button', { name: /Operaciones/ })).not.toBeInTheDocument();
  });
});
