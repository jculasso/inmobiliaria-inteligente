import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
