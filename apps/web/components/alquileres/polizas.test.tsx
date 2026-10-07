import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({ crearPoliza: vi.fn(), anularPoliza: vi.fn() }));

import { Polizas } from './polizas';

describe('Polizas', () => {
  it('en la ficha de un contrato vigente se puede cargar una póliza', () => {
    render(<Polizas polizas={[]} contratos={[]} contratoFijo="c1" />);
    expect(screen.getByRole('button', { name: '＋ Nueva póliza' })).toBeInTheDocument();
  });

  // Prueba en producción, 6/10/2026: un contrato rescindido seguía ofreciéndola.
  it('en uno que no está vigente, no', () => {
    render(<Polizas polizas={[]} contratos={[]} contratoFijo="c1" sePuedeAgregar={false} />);
    expect(screen.queryByRole('button', { name: '＋ Nueva póliza' })).not.toBeInTheDocument();
  });

  // Javier, 7/10/2026: que pregunte igual que los impuestos de cada propiedad.
  it('regla 46: quién la debe y quién la paga es un solo campo, con las seis frases', () => {
    render(<Polizas polizas={[]} contratos={[]} contratoFijo="c1" />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Nueva póliza' }));
    expect(screen.queryByLabelText('La debe')).toBeNull();
    expect(screen.queryByLabelText('La paga')).toBeNull();
    const campo = screen.getByLabelText('Quién la paga y a quién se le carga') as HTMLSelectElement;
    expect(campo.options).toHaveLength(6);
    expect(campo.selectedOptions[0]!.textContent).toBe(
      'La paga la inmobiliaria y se le cobra al inquilino en su próximo recibo',
    );
  });
});
