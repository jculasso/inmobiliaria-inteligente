import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RankingItem } from '@vacker/types';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

const ANA: RankingItem = {
  usuarioId: 'a',
  nombre: 'Ana',
  fotoUrl: null,
  volumen: 800,
  operaciones: 2,
  puntas: 2,
  puntasCompradoras: 1,
  puntasVendedoras: 1,
  ticketPromedio: 400,
  comision: 50,
  peso: 1,
};
const AGG = {
  volumen: 800,
  operaciones: 2,
  puntas: 2,
  puntasCompradoras: 1,
  puntasVendedoras: 1,
  comision: 50,
  comisionCompradora: 20,
  comisionVendedora: 30,
  ticketPromedio: 400,
};

const getResumenPeriodo = vi.fn();
vi.mock('../../lib/tablero-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/tablero-api')>();
  return { ...original, getResumenPeriodo: (...args: unknown[]) => getResumenPeriodo(...args) };
});

import { TotalesVendedores } from './totales-vendedores';

beforeEach(() => {
  getResumenPeriodo.mockReset();
  getResumenPeriodo.mockResolvedValue({ agregado: AGG, ranking: [ANA] });
});

/**
 * El pedido de Vacker, al pie de la letra: «unificar "ranking de vendedores"
 * con "totales de vendedor" (el primero quedaría eliminado). Lo único que
 * habría que agregar a "totales de vendedor" es la parte de "acumulado año",
 * "acumulado trimestral" y "mes seleccionado"».
 *
 * La primera versión dejó el selector en las pestañas del Resumen, lejos de la
 * tabla, y en la pantalla real no se leía como implementado. El selector va
 * ENCIMA de la tabla.
 */
describe('TotalesVendedores — el selector de período, encima de la tabla', () => {
  it('ofrece las tres opciones que pidió Vacker, con esos nombres', async () => {
    render(<TotalesVendedores anio={2026} mesSeleccionado={7} />);
    for (const opcion of ['Acumulado año', 'Acumulado trimestral', 'Mes seleccionado']) {
      expect(screen.getByRole('button', { name: opcion })).toBeInTheDocument();
    }
    // Dos veces: la tabla de escritorio y las tarjetas del celular (cuál se ve
    // lo decide el CSS, que jsdom no aplica).
    expect((await screen.findAllByText('Ana')).length).toBeGreaterThan(0);
  });

  it('arranca en el año, sin volver a pedir lo que ya trajo la página', async () => {
    render(
      <TotalesVendedores anio={2026} mesSeleccionado={7} inicial={{ agregado: AGG, ranking: [ANA] }} />,
    );
    expect(screen.getByText(/Totales por vendedor · Año 2026/)).toBeInTheDocument();
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
    expect(getResumenPeriodo).not.toHaveBeenCalled();
  });

  it('el acumulado trimestral muestra Q1–Q4 y pide el trimestre elegido', async () => {
    render(<TotalesVendedores anio={2026} mesSeleccionado={7} />);
    await userEvent.click(screen.getByRole('button', { name: 'Acumulado trimestral' }));
    expect(screen.getByText(/Totales por vendedor · Q3 2026/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Q1' }));
    expect(screen.getByText(/Totales por vendedor · Q1 2026/)).toBeInTheDocument();
    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'trimestral',
      mes: 7,
      trimestre: 1,
    });
  });

  it('el mes seleccionado es el de arriba del tablero', async () => {
    render(<TotalesVendedores anio={2026} mesSeleccionado={7} verTodo />);
    await userEvent.click(screen.getByRole('button', { name: 'Mes seleccionado' }));
    expect(screen.getByText(/Totales por vendedor · Julio 2026/)).toBeInTheDocument();
    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'mensual',
      mes: 7,
      trimestre: 3,
      verTodo: true,
    });
  });

  it('los Q1–Q4 solo aparecen en el trimestral', async () => {
    render(<TotalesVendedores anio={2026} mesSeleccionado={7} />);
    expect(screen.queryByRole('button', { name: 'Q1' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mes seleccionado' }));
    expect(screen.queryByRole('button', { name: 'Q1' })).not.toBeInTheDocument();
  });
});
