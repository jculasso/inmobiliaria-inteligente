import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPanel } from './login-panel';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const signInWithPassword = vi.fn();
vi.mock('../../lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('LoginPanel', () => {
  it('muestra el formulario de login', () => {
    render(<LoginPanel />);
    expect(screen.getByRole('heading', { name: /Iniciar sesión/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Clave/)).toBeInTheDocument();
  });

  it('refresca la Home cuando el login es exitoso', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPanel />);

    await userEvent.type(screen.getByLabelText(/Email/), 'demo@vacker.com');
    await userEvent.type(screen.getByLabelText(/Clave/), 'secreta123');
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'demo@vacker.com',
      password: 'secreta123',
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('alterna mostrar/ocultar la clave', async () => {
    render(<LoginPanel />);

    const claveInput = screen.getByLabelText(/Clave/);
    expect(claveInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /Mostrar clave/ }));
    expect(claveInput).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: /Ocultar clave/ }));
    expect(claveInput).toHaveAttribute('type', 'password');
  });

  it('muestra un error cuando las credenciales son inválidas', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    render(<LoginPanel />);

    await userEvent.type(screen.getByLabelText(/Email/), 'demo@vacker.com');
    await userEvent.type(screen.getByLabelText(/Clave/), 'mal');
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrectos/i);
    expect(refresh).not.toHaveBeenCalled();
  });
});
