import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MENSAJE_GOOGLE_ERROR, TodoView } from './todo-view';

const replace = vi.fn();
let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/todo',
  useSearchParams: () => params,
}));

const getTodoEstado = vi.fn();
const getTodoEventos = vi.fn();
const getTodoConnectUrl = vi.fn();
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/todo-api', () => ({
  getTodoEstado: (...a: unknown[]) => getTodoEstado(...a),
  getTodoEventos: (...a: unknown[]) => getTodoEventos(...a),
  getTodoConnectUrl: (...a: unknown[]) => getTodoConnectUrl(...a),
  desconectarTodo: vi.fn(),
}));

const SIN_EVENTOS = { desde: '2026-10-05', hasta: '2026-10-11', eventos: [] };

beforeEach(() => {
  params = new URLSearchParams();
  replace.mockReset();
  getTodoEstado.mockReset();
  getTodoEventos.mockReset();
  getTodoConnectUrl.mockReset();
});

describe('TodoView — la vuelta de Google', () => {
  it('con ?google=error explica qué pasó y ofrece reintentar', async () => {
    params = new URLSearchParams('google=error');
    getTodoEstado.mockResolvedValue({ conectado: false, googleEmail: null });
    getTodoEventos.mockRejectedValue(new Error('No conectado'));
    render(<TodoView />);

    expect(await screen.findByText(MENSAJE_GOOGLE_ERROR)).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });

  it('saca el ?google= de la dirección: recargar no vuelve a mostrar el aviso', async () => {
    params = new URLSearchParams('google=conectado');
    getTodoEstado.mockResolvedValue({ conectado: true, googleEmail: 'ana@gmail.com' });
    getTodoEventos.mockResolvedValue(SIN_EVENTOS);
    render(<TodoView />);

    expect(await screen.findByText(/quedó conectado/)).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/todo');
  });

  it('el estado y los eventos se piden juntos, y los eventos una sola vez', async () => {
    getTodoEstado.mockResolvedValue({ conectado: true, googleEmail: 'ana@gmail.com' });
    getTodoEventos.mockResolvedValue(SIN_EVENTOS);
    render(<TodoView />);

    await screen.findByRole('button', { name: 'Desconectar' });
    expect(getTodoEstado).toHaveBeenCalledTimes(1);
    expect(getTodoEventos).toHaveBeenCalledTimes(1);
  });

  it('instalada como app, al volver de Google se libera «Redirigiendo…» y se vuelve a mirar', async () => {
    getTodoEstado.mockResolvedValue({ conectado: false, googleEmail: null });
    getTodoEventos.mockRejectedValue(new Error('No conectado'));
    // Google nunca «vuelve»: la app queda en segundo plano.
    getTodoConnectUrl.mockResolvedValue({ url: '#google' });
    render(<TodoView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Google' }));
    expect(await screen.findByRole('button', { name: 'Redirigiendo…' })).toBeDisabled();

    getTodoEstado.mockResolvedValue({ conectado: false, googleEmail: null });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Conectar Google' })).toBeEnabled(),
    );
    expect(getTodoEstado).toHaveBeenCalledTimes(2);
  });
});
