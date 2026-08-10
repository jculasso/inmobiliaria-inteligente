import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableroVolumenPreview } from './tablero-volumen-preview';

vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
const pedidos: unknown[] = [];
vi.mock('../../lib/tablero-api', () => ({
  getKpisResumen: (_t: string, filtro: unknown) => {
    pedidos.push(filtro);
    return Promise.resolve({ anual: { volumen: 8452500 } });
  },
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

/**
 * La card dice el alcance al lado del número ("· Total"). Si pidiera sin
 * `verTodo`, el backend devolvería solo lo del usuario y el rótulo estaría
 * mintiendo: un número propio presentado como el de toda la inmobiliaria.
 */
describe('TableroVolumenPreview — el número coincide con su etiqueta', () => {
  it('con alcance total, pide verTodo', async () => {
    pedidos.length = 0;
    render(<TableroVolumenPreview anio={2026} alcance="total" />);
    await screen.findByText('$8.452.500');
    expect(pedidos[0]).toMatchObject({ verTodo: true });
  });

  it('con alcance propio, no lo pide', async () => {
    pedidos.length = 0;
    render(<TableroVolumenPreview anio={2026} alcance="propio" />);
    await screen.findByText('$8.452.500');
    expect(pedidos[0]).toMatchObject({ verTodo: false });
  });
});
