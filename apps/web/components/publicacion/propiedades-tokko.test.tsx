import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { precioDe, PropiedadesTokko } from './propiedades-tokko';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const importarPropiedades = vi.fn();
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/publicacion-api', () => ({
  importarPropiedades: (...a: unknown[]) => importarPropiedades(...a),
  vaciarPropiedades: vi.fn(),
}));

beforeEach(() => {
  refresh.mockReset();
  importarPropiedades.mockReset();
});

describe('PropiedadesTokko — traer de Tokko', () => {
  it('si el pedido corta por tiempo, lo dice y deja reintentar (no gira para siempre)', async () => {
    importarPropiedades
      .mockRejectedValueOnce(
        new Error('El servidor tardó demasiado en responder. Probá de nuevo en un momento.'),
      )
      .mockResolvedValueOnce({ leidas: 10, creadas: 10, actualizadas: 0, sinAgente: 0 });
    render(<PropiedadesTokko inicial={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Traer de Tokko' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('tardó demasiado');
    // Se refresca igual: la API pudo haber terminado después del corte.
    expect(refresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(importarPropiedades).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('10 propiedades leídas')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('precioDe', () => {
  it('dólares como «U$S» y pesos como el resto de la app', () => {
    expect(precioDe({ precio: 185000, moneda: 'USD' })).toBe('U$S 185.000');
    expect(precioDe({ precio: 120_000_000, moneda: 'ARS' })).toBe('$ 120.000.000,00');
    expect(precioDe({ precio: null, moneda: 'USD' })).toBe('—');
  });
});
