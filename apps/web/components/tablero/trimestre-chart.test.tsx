import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrimestreChart } from './trimestre-chart';

const DATOS = [
  { volumen: 4000, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, comision: 100, ticketPromedio: 4000 },
  { volumen: 4100, operaciones: 1, puntas: 1, puntasCompradoras: 1, puntasVendedoras: 0, comision: 110, ticketPromedio: 4100 },
  { volumen: 200, operaciones: 1, puntas: 1, puntasCompradoras: 0, puntasVendedoras: 1, comision: 10, ticketPromedio: 200 },
  { volumen: 0, operaciones: 0, puntas: 0, puntasCompradoras: 0, puntasVendedoras: 0, comision: 0, ticketPromedio: 0 },
];

// El componente dibuja los mismos trimestres dos veces: el gráfico SVG en
// pantalla ancha y barras acostadas en el celular (cuál se ve lo decide el CSS,
// que jsdom no aplica). Cada test dice qué vista mira.
const enElGrafico = () => within(screen.getByRole('img', { name: /trimestre/i }));
const enLasBarras = () => within(screen.getByRole('list', { name: /trimestre/i }));

describe('TrimestreChart', () => {
  it('muestra las 4 etiquetas de trimestre y la leyenda', () => {
    render(<TrimestreChart datos={DATOS} seleccionado={1} onSelect={vi.fn()} />);
    expect(enElGrafico().getByText('Q1')).toBeInTheDocument();
    expect(enElGrafico().getByText('Q4')).toBeInTheDocument();
    expect(screen.getByText('Volumen USD')).toBeInTheDocument();
    expect(screen.getByText('Comisión USD')).toBeInTheDocument();
  });

  it('al hacer click en una barra llama a onSelect con el trimestre', async () => {
    const onSelect = vi.fn();
    render(<TrimestreChart datos={DATOS} seleccionado={1} onSelect={onSelect} />);

    await userEvent.click(enElGrafico().getByText('Q3'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('en el celular los trimestres son barras acostadas, y también seleccionan', async () => {
    // Regresión: el gráfico medía 552px y a 360px se salía 226px, así que había
    // que deslizarlo de costado — el "baile".
    const onSelect = vi.fn();
    render(<TrimestreChart datos={DATOS} seleccionado={1} onSelect={onSelect} />);

    expect(enLasBarras().getAllByRole('listitem')).toHaveLength(4);
    await userEvent.click(enLasBarras().getByText('Q3'));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
