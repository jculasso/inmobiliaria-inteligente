import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableroVolumenPreview } from './tablero-volumen-preview';

vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
const pedidos: unknown[] = [];
let fallarProximos = 0;
vi.mock('../../lib/tablero-api', () => ({
  getKpisResumen: (_t: string, filtro: unknown) => {
    pedidos.push(filtro);
    if (fallarProximos > 0) {
      fallarProximos--;
      return Promise.reject(new Error('sin red'));
    }
    return Promise.resolve({ anual: { volumen: 8452500 } });
  },
}));

describe('TableroVolumenPreview', () => {
  it('muestra "…" mientras carga y luego el volumen formateado con el alcance', async () => {
    render(<TableroVolumenPreview anio={2026} alcance="total" />);
    // Estado inicial (aún sin resolver el fetch).
    expect(screen.getByText('…')).toBeInTheDocument();
    // Una vez resuelto, el número formateado.
    expect(await screen.findByText('U$S 8.452.500')).toBeInTheDocument();
    expect(screen.getByText(/Total/)).toBeInTheDocument();
  });
});

/**
 * La card dice el alcance al lado del número ("· Total"). Si pidiera sin
 * `verTodo`, el backend devolvería solo lo del usuario y el rótulo estaría
 * mintiendo: un número propio presentado como el de toda la inmobiliaria.
 */
describe('TableroVolumenPreview — el número coincide con su etiqueta', () => {
  it('con alcance total, pide verTodo', async () => {
    pedidos.length = 0;
    render(<TableroVolumenPreview anio={2026} alcance="total" />);
    await screen.findByText('U$S 8.452.500');
    expect(pedidos[0]).toMatchObject({ verTodo: true });
  });

  it('con alcance propio, no lo pide', async () => {
    pedidos.length = 0;
    render(<TableroVolumenPreview anio={2026} alcance="propio" />);
    await screen.findByText('U$S 8.452.500');
    expect(pedidos[0]).toMatchObject({ verTodo: false });
  });
});

describe('TableroVolumenPreview — si el pedido falla', () => {
  it('muestra «—» y un Reintentar, en vez de quedarse en «…» para siempre', async () => {
    fallarProximos = 1;
    render(<TableroVolumenPreview anio={2026} alcance="total" />);

    const reintentar = await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();

    await userEvent.click(reintentar);
    expect(await screen.findByText('U$S 8.452.500')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
});
