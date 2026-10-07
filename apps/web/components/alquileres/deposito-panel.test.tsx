import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DepositoDto } from '@vacker/types';

const entregarDeposito = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  entregarDeposito: (...a: unknown[]) => entregarDeposito(...a),
  devolverDeposito: vi.fn(),
}));

import { DepositoPanel } from './deposito-panel';

const cobrado: DepositoDto = {
  importe: 800_000,
  moneda: 'ARS',
  gestion: 'entrega_propietario',
  estado: 'cobrado',
  cobrado: 800_000,
  devueltoEl: null,
};

describe('DepositoPanel', () => {
  // Prueba en producción, 6/10/2026: «Entregar al propietario» movía la plata
  // con el primer toque.
  it('entregar al propietario pide confirmación con el importe y a quién', async () => {
    entregarDeposito.mockResolvedValueOnce({});
    render(<DepositoPanel contratoId="c1" deposito={cobrado} propietarios={['Ana Pérez']} />);
    fireEvent.click(screen.getByRole('button', { name: '🤝 Entregar al propietario' }));
    expect(entregarDeposito).not.toHaveBeenCalled();
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText(/Se le entregan/)).toHaveTextContent(
      'Se le entregan $ 800.000,00 a Ana Pérez',
    );
    fireEvent.click(dialogo.getByRole('button', { name: '🤝 Entregar' }));
    await waitFor(() => expect(entregarDeposito).toHaveBeenCalledWith('token', 'c1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cancelar no entrega nada', () => {
    entregarDeposito.mockClear();
    render(<DepositoPanel contratoId="c1" deposito={cobrado} propietarios={['Ana Pérez']} />);
    fireEvent.click(screen.getByRole('button', { name: '🤝 Entregar al propietario' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(entregarDeposito).not.toHaveBeenCalled();
  });
});
