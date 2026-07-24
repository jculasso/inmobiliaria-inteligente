import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlanTenant } from '@vacker/types';
import { HomeView } from './home-view';

vi.mock('./logout-button', () => ({ LogoutButton: () => <button>Cerrar sesión</button> }));
vi.mock('./home/login-panel', () => ({ LoginPanel: () => <div>Formulario de login</div> }));
// El volumen se pide client-side (ver TableroVolumenPreview.test.tsx); acá solo
// verificamos que la card lo renderice para quien tiene alcance.
vi.mock('./home/tablero-volumen-preview', () => ({ TableroVolumenPreview: () => <div>preview-volumen</div> }));

function tenant(plan: PlanTenant = 'enterprise', nombre = 'Vacker') {
  return { nombre, plan, config: {} };
}

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
  it('muestra el nombre del tenant, el email y el Tablero, el Tasador y el To Do como Activo', () => {
    render(<HomeView sesion={{ email: 'demo@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: tenant() }} />);
    expect(screen.getByRole('heading', { name: /Vacker · Plataforma 2\.0/ })).toBeInTheDocument();
    expect(screen.getByText('demo@vacker.com')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(3);
    const entrar = screen.getAllByRole('link', { name: 'Entrar' });
    expect(entrar.map((a) => a.getAttribute('href'))).toEqual(['/tablero', '/tasador', '/todo']);
  });

  it('muestra el nombre de la inmobiliaria logueada, no uno hardcodeado', () => {
    render(
      <HomeView sesion={{ email: 'demo@sanso.com.ar', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: tenant('enterprise', 'Sanso Propiedades') }} />,
    );
    expect(screen.getByRole('heading', { name: /Sanso Propiedades · Plataforma 2\.0/ })).toBeInTheDocument();
  });

  it('deshabilita el Tasador si el plan del tenant no lo incluye', () => {
    render(<HomeView sesion={{ email: 'demo@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: tenant('basico') }} />);
    const entrar = screen.getAllByRole('link', { name: 'Entrar' });
    expect(entrar.map((a) => a.getAttribute('href'))).toEqual(['/tablero']);
  });

  it('deshabilita el Tablero y el Tasador cuando el usuario no tiene alcance de tenant (admin_plataforma)', () => {
    render(<HomeView sesion={{ email: 'soporte@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['admin_plataforma'], tenant: tenant() }} />);
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('renderiza la preview de volumen del Tablero para un rol con alcance', () => {
    render(
      <HomeView sesion={{ email: 'ceo@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['direccion'], tenant: tenant() }} />,
    );
    expect(screen.getByText('preview-volumen')).toBeInTheDocument();
  });

  it('no renderiza la preview de volumen sin alcance de tenant (admin_plataforma)', () => {
    render(
      <HomeView sesion={{ email: 'soporte@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['admin_plataforma'], tenant: tenant() }} />,
    );
    expect(screen.queryByText('preview-volumen')).not.toBeInTheDocument();
  });
});
