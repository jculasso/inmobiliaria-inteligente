import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvolucionVentasChart } from './evolucion-ventas-chart';

const DATOS = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, volumen: (i + 1) * 1000 }));

describe('EvolucionVentasChart', () => {
  it('muestra el título con el año y una barra por mes', () => {
    render(<EvolucionVentasChart anio={2026} datos={DATOS} />);
    expect(screen.getByText('Evolución de ventas · 2026')).toBeInTheDocument();
    expect(screen.getByText('Ene')).toBeInTheDocument();
    expect(screen.getByText('Dic')).toBeInTheDocument();
  });

  it('muestra el valor del mes al pasar el mouse por la barra', async () => {
    render(<EvolucionVentasChart anio={2026} datos={DATOS} />);
    expect(screen.queryByText('$1.000')).not.toBeInTheDocument();

    const primeraBarra = document.querySelector('rect')!;
    await userEvent.hover(primeraBarra);
    expect(screen.getByText('$1.000')).toBeInTheDocument();
  });
});
