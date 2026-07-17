import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrimestreChart } from './trimestre-chart';

const DATOS = [
  { volumen: 4000, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, comision: 100, ticketPromedio: 4000 },
  { volumen: 4100, operaciones: 1, puntas: 1, puntasCompradoras: 1, puntasVendedoras: 0, comision: 110, ticketPromedio: 4100 },
  { volumen: 200, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, comision: 10, ticketPromedio: 200 },
  { volumen: 0, operaciones: 0, puntas: 0, puntasCompradoras: 0, puntasVendedoras: 0, comision: 0, ticketPromedio: 0 },
];

describe('TrimestreChart', () => {
  it('muestra las 4 etiquetas de trimestre y la leyenda', () => {
    render(<TrimestreChart datos={DATOS} seleccionado={1} onSelect={vi.fn()} />);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Q4')).toBeInTheDocument();
    expect(screen.getByText('Volumen USD')).toBeInTheDocument();
    expect(screen.getByText('Comisión USD')).toBeInTheDocument();
  });

  it('al hacer click en una barra llama a onSelect con el trimestre', async () => {
    const onSelect = vi.fn();
    render(<TrimestreChart datos={DATOS} seleccionado={1} onSelect={onSelect} />);

    await userEvent.click(screen.getByText('Q3'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
