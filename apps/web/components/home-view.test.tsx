import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeView } from './home-view';

vi.mock('./logout-button', () => ({ LogoutButton: () => <button>Cerrar sesión</button> }));
vi.mock('./home/login-panel', () => ({ LoginPanel: () => <div>Formulario de login</div> }));

describe('HomeView · modo invitado (sin sesión)', () => {
  it('muestra el login embebido y las 3 cards apagadas', () => {
    render(<HomeView sesion={null} />);
    expect(screen.getByText('Formulario de login')).toBeInTheDocument();
    expect(screen.getByText('Tablero Comercial')).toBeInTheDocument();
    expect(screen.getByText('Tasador')).toBeInTheDocument();
    expect(screen.getByText('To Do List')).toBeInTheDocument();
    expect(screen.getAllByText(/Iniciá sesión para ver más/)).toHaveLength(3);
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});

describe('HomeView · modo logueado', () => {
  it('muestra el email y el Tablero y el Tasador como Activo', () => {
    render(<HomeView sesion={{ email: 'demo@vacker.com', roles: ['vendedor'] }} />);
    expect(screen.getByRole('heading', { name: /Vacker · Plataforma 2\.0/ })).toBeInTheDocument();
    expect(screen.getByText('demo@vacker.com')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(2);
    const entrar = screen.getAllByRole('link', { name: 'Entrar' });
    expect(entrar.map((a) => a.getAttribute('href'))).toEqual(['/tablero', '/tasador']);
  });

  it('deshabilita el Tablero y el Tasador cuando el usuario no tiene alcance de tenant (admin_plataforma)', () => {
    render(<HomeView sesion={{ email: 'soporte@vacker.com', roles: ['admin_plataforma'] }} />);
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('muestra el link a Administración solo si el usuario tiene el rol admin_plataforma', () => {
    render(<HomeView sesion={{ email: 'soporte@vacker.com', roles: ['admin_plataforma'] }} />);
    expect(screen.getByRole('link', { name: 'Administración →' })).toHaveAttribute('href', '/admin');
  });

  it('no muestra el link a Administración para un usuario sin ese rol', () => {
    render(<HomeView sesion={{ email: 'demo@vacker.com', roles: ['vendedor'] }} />);
    expect(screen.queryByRole('link', { name: 'Administración →' })).not.toBeInTheDocument();
  });

  it('muestra la preview de volumen cuando viene en la sesión', () => {
    render(<HomeView sesion={{ email: 'ceo@vacker.com', roles: ['direccion'], volumenAnual: 8452500 }} />);
    expect(screen.getByText('$8.452.500')).toBeInTheDocument();
    expect(screen.getByText(/Total/)).toBeInTheDocument();
  });
});
