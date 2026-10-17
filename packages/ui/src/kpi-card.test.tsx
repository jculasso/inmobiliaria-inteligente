import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  // Dashboard de Alquileres, 7/10/2026: con etiquetas de una y de dos líneas los números quedaban desparejos.
  it('en tarjetas angostas la etiqueta reserva dos líneas, para que los números queden alineados', () => {
    render(<KpiCard label="Contratos vigentes" value="10" />);
    expect(screen.getByText('Contratos vigentes').parentElement).toHaveClass(
      '@max-[17rem]:min-h-[34px]',
    );
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

  // Dashboard de Alquileres en tres bloques (17/10/2026): la cobranza con su
  // barra y la deuda con su leyenda, donde cada tramo abre su lista.
  it('lo de abajo del número va dentro de la tarjeta; el pie, fuera del botón y con sus propios botones', () => {
    const abrirTramo = vi.fn();
    const abrir = vi.fn();
    render(
      <KpiCard
        label="Deuda vencida"
        value="$ 9,8 M"
        onClick={abrir}
        pie={
          <button type="button" onClick={abrirTramo}>
            31–60 $ 1,4 M
          </button>
        }
      >
        <span>9 inquilinos</span>
      </KpiCard>,
    );
    const tarjeta = screen.getByRole('button', { name: 'Deuda vencida: $ 9,8 M. Ver el detalle' });
    expect(tarjeta).toContainElement(screen.getByText('9 inquilinos'));
    const tramo = screen.getByRole('button', { name: '31–60 $ 1,4 M' });
    expect(tarjeta).not.toContainElement(tramo);
    fireEvent.click(tramo);
    expect(abrirTramo).toHaveBeenCalledTimes(1);
    expect(abrir).not.toHaveBeenCalled();
  });

  it('sin lo nuevo, la tarjeta del Tablero Comercial queda igual', () => {
    const { container } = render(<KpiCard label="Volumen" value="$1" onClick={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.querySelector('button')).toHaveClass('h-full');
  });

  it('la que se abre dice qué hace al tocarla', () => {
    render(<KpiCard label="Comisión" value="$66.990" onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Comisión: $66.990. Ver el detalle' }),
    ).toBeInTheDocument();
  });
});
