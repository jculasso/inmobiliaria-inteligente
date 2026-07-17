import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeView } from './home-view';

vi.mock('./logout-button', () => ({ LogoutButton: () => <button>Cerrar sesión</button> }));

describe('HomeView', () => {
  it('muestra el título, el email y los tres módulos', () => {
    render(<HomeView email="demo@vacker.com" roles={['vendedor']} />);
    expect(screen.getByRole('heading', { name: /Vacker · Plataforma 2\.0/ })).toBeInTheDocument();
    expect(screen.getByText('demo@vacker.com')).toBeInTheDocument();
    expect(screen.getByText('Tablero Comercial')).toBeInTheDocument();
    expect(screen.getByText('Tasador')).toBeInTheDocument();
    expect(screen.getByText('To Do List')).toBeInTheDocument();
  });

  it('marca el Tablero como Activo y habilita "Entrar" para un vendedor', () => {
    render(<HomeView email="demo@vacker.com" roles={['vendedor']} />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Tu alcance: Propio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/tablero');
  });

  it('muestra el alcance Total para dirección', () => {
    render(<HomeView email="ceo@vacker.com" roles={['direccion']} />);
    expect(screen.getByText('Tu alcance: Total')).toBeInTheDocument();
  });

  it('deshabilita el Tablero cuando el usuario no tiene alcance de tenant (admin_plataforma)', () => {
    render(<HomeView email="soporte@vacker.com" roles={['admin_plataforma']} />);
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
