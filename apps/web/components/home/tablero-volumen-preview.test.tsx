import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableroVolumenPreview } from './tablero-volumen-preview';

vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/tablero-api', () => ({
  getKpisResumen: () => Promise.resolve({ anual: { volumen: 8452500 } }),
}));

describe('TableroVolumenPreview', () => {
  it('muestra "…" mientras carga y luego el volumen formateado con el alcance', async () => {
    render(<TableroVolumenPreview anio={2026} alcance="total" />);
    // Estado inicial (aún sin resolver el fetch).
    expect(screen.getByText('…')).toBeInTheDocument();
    // Una vez resuelto, el número formateado.
    expect(await screen.findByText('$8.452.500')).toBeInTheDocument();
    expect(screen.getByText(/Total/)).toBeInTheDocument();
  });
});
