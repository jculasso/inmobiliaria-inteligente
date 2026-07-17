import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingTable } from './ranking-table';

const ITEMS = [
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

describe('RankingTable', () => {
  it('muestra el ranking ordenado por volumen, abierto por default', () => {
    render(<RankingTable items={ITEMS} />);
    const filas = screen.getAllByRole('row');
    expect(filas[1]).toHaveTextContent('Ana');
    expect(filas[2]).toHaveTextContent('Beto');
  });

  it('se puede colapsar y volver a abrir', async () => {
    render(<RankingTable items={ITEMS} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ranking de vendedores/ }));
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ranking de vendedores/ }));
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('muestra un mensaje cuando no hay datos', async () => {
    render(<RankingTable items={[]} />);
    expect(screen.getByText(/Sin datos para el período/)).toBeInTheDocument();
  });
});
