import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingTable } from './ranking-table';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

const RANKING = [
  {
    usuarioId: '1',
    nombre: 'Ana',
    volumen: 100,
    operaciones: 1,
    puntas: 1,
    puntasCompradoras: 0,
    puntasVendedoras: 1,
    ticketPromedio: 100,
    comision: 5,
    peso: 0.6,
  },
  {
    usuarioId: '2',
    nombre: 'Beto',
    volumen: 50,
    operaciones: 1,
    puntas: 1,
    puntasCompradoras: 1,
    puntasVendedoras: 0,
    ticketPromedio: 50,
    comision: 2,
    peso: 0.4,
  },
];

const getResumenPeriodo = vi.fn().mockResolvedValue({
  agregado: {
    volumen: 150,
    operaciones: 2,
    puntas: 2,
    puntasCompradoras: 1,
    puntasVendedoras: 1,
    comision: 7,
    ticketPromedio: 75,
  },
  ranking: RANKING,
});
vi.mock('../../lib/tablero-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tablero-api')>();
  return { ...actual, getResumenPeriodo: (...args: unknown[]) => getResumenPeriodo(...args) };
});

describe('RankingTable', () => {
  it('abierto por default, arranca en el tab "Acumulado año" y muestra el ranking', async () => {
    render(<RankingTable anio={2026} mesSeleccionado={7} />);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
    expect(getResumenPeriodo).toHaveBeenCalledWith('token', {
      anio: 2026,
      periodo: 'anual',
      mes: 7,
      trimestre: 3,
    });
  });

  it('se puede colapsar y volver a abrir', async () => {
    render(<RankingTable anio={2026} mesSeleccionado={7} />);
    await screen.findByText('Ana');

    await userEvent.click(screen.getByRole('button', { name: /Ranking de vendedores/ }));
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ranking de vendedores/ }));
    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('el tab "Acumulado trimestral" muestra los sub-tabs Q1-Q4 y cambia el período pedido', async () => {
    render(<RankingTable anio={2026} mesSeleccionado={7} />);
    await screen.findByText('Ana');

    await userEvent.click(screen.getByRole('button', { name: 'Acumulado trimestral' }));
    await userEvent.click(screen.getByRole('button', { name: 'Q1' }));

    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'trimestral',
      mes: 7,
      trimestre: 1,
    });
  });

  it('el tab "Mes seleccionado" pide el período mensual', async () => {
    render(<RankingTable anio={2026} mesSeleccionado={7} />);
    await screen.findByText('Ana');

    await userEvent.click(screen.getByRole('button', { name: 'Mes seleccionado' }));

    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'mensual',
      mes: 7,
      trimestre: 3,
    });
  });
});
