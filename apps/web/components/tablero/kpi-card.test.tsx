import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './kpi-card';

describe('KpiCard', () => {
  it('muestra label, valor y sub opcional', () => {
    render(<KpiCard label="Volumen mes" value="$45.000" sub="12 operaciones" />);
    expect(screen.getByText('Volumen mes')).toBeInTheDocument();
    expect(screen.getByText('$45.000')).toBeInTheDocument();
    expect(screen.getByText('12 operaciones')).toBeInTheDocument();
  });

  it('no rompe si no hay sub', () => {
    render(<KpiCard label="Puntas" value="8" />);
    expect(screen.getByText('Puntas')).toBeInTheDocument();
  });

  it('muestra el ícono cuando se pasa', () => {
    render(<KpiCard label="Comisión" value="$230.692" icon="💵" />);
    expect(screen.getByText('💵')).toBeInTheDocument();
  });
});
