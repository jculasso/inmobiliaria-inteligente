import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VendedorTotalesTable } from './vendedor-totales-table';

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

describe('VendedorTotalesTable', () => {
  it('ordena por volumen descendente', () => {
    render(<VendedorTotalesTable items={ITEMS} />);
    const filas = screen.getAllByRole('row');
    expect(filas[1]).toHaveTextContent('Ana');
    expect(filas[2]).toHaveTextContent('Beto');
  });

  it('muestra un mensaje cuando no hay datos', () => {
    render(<VendedorTotalesTable items={[]} />);
    expect(screen.getByText(/Sin datos para el período/)).toBeInTheDocument();
  });
});
