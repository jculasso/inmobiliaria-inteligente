import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let ruta = '/alquileres';
vi.mock('next/navigation', () => ({ usePathname: () => ruta }));

import { AlquileresNav } from './alquileres-nav';

describe('AlquileresNav', () => {
  // Javier, 6/10/2026: «donde dice inicio en el menu debe decir dashboard» y «se corta».
  it('arranca en Dashboard y son once pestañas, no trece', () => {
    render(<AlquileresNav />);
    const principal = screen.getByRole('navigation', { name: 'Alquileres' });
    expect(principal.querySelectorAll('a')).toHaveLength(11);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Inicio' })).not.toBeInTheDocument();
  });

  it('una pestaña agrupada abre su segunda fila y marca la pantalla', () => {
    ruta = '/alquileres/proveedores';
    render(<AlquileresNav />);
    expect(screen.getByRole('link', { name: 'Gastos' })).toHaveAttribute('aria-current', 'page');
    const sub = screen.getByRole('navigation', { name: 'Gastos' });
    expect(sub).toHaveTextContent('Impuestos y servicios');
    expect(screen.getByRole('link', { name: 'Proveedores' })).toHaveAttribute('aria-current', 'page');
  });

  it('la ficha de un contrato sigue marcando Contratos, sin segunda fila', () => {
    ruta = '/alquileres/contratos/abc';
    render(<AlquileresNav />);
    expect(screen.getByRole('link', { name: 'Contratos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});
