import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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
    expect(screen.getByRole('link', { name: 'Proveedores' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // Auditoría del 6/10/2026: en Plantillas no quedaba marcada ninguna pestaña.
  it('las plantillas de contrato marcan Configuración y su segunda fila', () => {
    ruta = '/alquileres/plantillas';
    render(<AlquileresNav />);
    const principal = within(screen.getByRole('navigation', { name: 'Alquileres' }));
    expect(principal.getByRole('link', { name: 'Configuración' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const sub = within(screen.getByRole('navigation', { name: 'Configuración' }));
    expect(sub.getByRole('link', { name: 'Plantillas' })).toHaveAttribute('aria-current', 'page');
    expect(sub.getByRole('link', { name: 'Configuración' })).not.toHaveAttribute('aria-current');
  });

  // Regla 96: el informe de propietarios es una pantalla de Liquidaciones, no una pestaña más.
  it('el informe de propietarios marca Liquidaciones y su segunda fila', () => {
    ruta = '/alquileres/propietarios';
    render(<AlquileresNav />);
    const principal = within(screen.getByRole('navigation', { name: 'Alquileres' }));
    expect(principal.getAllByRole('link')).toHaveLength(11);
    expect(principal.getByRole('link', { name: 'Liquidaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const sub = within(screen.getByRole('navigation', { name: 'Liquidaciones' }));
    expect(sub.getByRole('link', { name: 'Informe de propietarios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sub.getByRole('link', { name: 'Liquidaciones' })).not.toHaveAttribute('aria-current');
  });

  it('una liquidación nueva sigue marcando Liquidaciones', () => {
    ruta = '/alquileres/liquidaciones/nueva';
    render(<AlquileresNav />);
    const sub = within(screen.getByRole('navigation', { name: 'Liquidaciones' }));
    expect(sub.getByRole('link', { name: 'Liquidaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // Regla 164: las reservas son una pantalla de Contratos, no una pestaña más.
  it('la ficha de un contrato sigue marcando Contratos, con Reservas en la segunda fila', () => {
    ruta = '/alquileres/contratos/abc';
    render(<AlquileresNav />);
    const principal = within(screen.getByRole('navigation', { name: 'Alquileres' }));
    expect(principal.getAllByRole('link')).toHaveLength(11);
    expect(principal.getByRole('link', { name: 'Contratos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const sub = within(screen.getByRole('navigation', { name: 'Contratos' }));
    expect(sub.getByRole('link', { name: 'Contratos' })).toHaveAttribute('aria-current', 'page');
    expect(sub.getByRole('link', { name: 'Reservas' })).not.toHaveAttribute('aria-current');
  });

  it('regla 164: una reserva marca Contratos y, en la segunda fila, Reservas', () => {
    ruta = '/alquileres/reservas/abc';
    render(<AlquileresNav />);
    const principal = within(screen.getByRole('navigation', { name: 'Alquileres' }));
    expect(principal.getByRole('link', { name: 'Contratos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const sub = within(screen.getByRole('navigation', { name: 'Contratos' }));
    expect(sub.getByRole('link', { name: 'Reservas' })).toHaveAttribute('aria-current', 'page');
  });
});
