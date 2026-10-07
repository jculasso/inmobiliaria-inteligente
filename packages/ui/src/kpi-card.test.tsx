import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './index';

describe('KpiCard', () => {
  it('muestra label, valor y sub opcional', () => {
    render(<KpiCard label="Volumen mes" value="$45.000" sub="12 operaciones" />);
    expect(screen.getByText('Volumen mes')).toBeInTheDocument();
    expect(screen.getByText('$45.000')).toBeInTheDocument();
    expect(screen.getByText('12 operaciones')).toBeInTheDocument();
  });

  // Conceptos, 7/10/2026: «$ 8.693.426,49 · U$S 1.627,05» en una línea se pisaba con la tarjeta de al lado.
  it('dos monedas van una por línea', () => {
    render(<KpiCard label="A cobrar" value="$ 8.693.426,49 · U$S 1.627,05" />);
    expect(screen.getByText('$ 8.693.426,49')).toHaveClass('block');
    expect(screen.getByText('U$S 1.627,05')).toHaveClass('block');
  });

  it('no rompe si no hay sub', () => {
    render(<KpiCard label="Puntas" value="8" />);
    expect(screen.getByText('Puntas')).toBeInTheDocument();
  });

  it('muestra el ícono cuando se pasa', () => {
    render(<KpiCard label="Comisión" value="$230.692" icon="💵" />);
    expect(screen.getByText('💵')).toBeInTheDocument();
  });

  /*
   * La lupa avisa que la tarjeta se abre. Tiene que estar en las que se abren
   * y en ninguna otra: una lupa que no hace nada es peor que no tenerla.
   */
  it('la tarjeta que se abre lleva la lupa; la que no, no', () => {
    const { container, rerender } = render(
      <KpiCard label="Volumen" value="$1" onClick={() => {}} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<KpiCard label="Volumen" value="$1" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('la que se abre dice qué hace al tocarla', () => {
    render(<KpiCard label="Comisión" value="$66.990" onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Comisión: $66.990. Ver el detalle' }),
    ).toBeInTheDocument();
  });
});
