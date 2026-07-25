import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MODULOS_DEFAULT, type ModulosTenant } from '@vacker/types';
import { HomeView } from './home-view';

vi.mock('./logout-button', () => ({ LogoutButton: () => <button>Cerrar sesión</button> }));
vi.mock('./home/login-panel', () => ({ LoginPanel: () => <div>Formulario de login</div> }));
// El volumen se pide client-side (ver TableroVolumenPreview.test.tsx); acá solo
// verificamos que la card lo renderice para quien tiene alcance.
vi.mock('./home/tablero-volumen-preview', () => ({ TableroVolumenPreview: () => <div>preview-volumen</div> }));

/** Por defecto, un tenant con los 3 módulos ya productivos habilitados. */
function tenant(modulos: Partial<ModulosTenant> = { tasador: true, todo: true }, nombre = 'Vacker') {
  return {
    nombre,
    plan: 'enterprise' as const,
    modulos: { ...MODULOS_DEFAULT, ...modulos },
    config: {},
  };
}

describe('HomeView · modo invitado (sin sesión)', () => {
  it('muestra el login embebido y las 4 cards apagadas', () => {
    render(<HomeView sesion={null} />);
    expect(screen.getByText('Formulario de login')).toBeInTheDocument();
    expect(screen.getByText('Tablero Comercial')).toBeInTheDocument();
    expect(screen.getByText('Tasador')).toBeInTheDocument();
    expect(screen.getByText('To Do List')).toBeInTheDocument();
    expect(screen.getByText('Protocolo 5 Semanas')).toBeInTheDocument();
    expect(screen.getAllByText(/Iniciá sesión para ver más/)).toHaveLength(4);
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});

describe('HomeView · modo logueado', () => {
  it('muestra el nombre del tenant, el email y los módulos habilitados como Activo', () => {
    render(
      <HomeView
        sesion={{
          email: 'demo@vacker.com',
          nombre: 'Demo',
          fotoUrl: null,
          roles: ['vendedor'],
          tenant: tenant({ tasador: true, todo: true, protocolo: true }),
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: /Vacker · Plataforma 2\.0/ })).toBeInTheDocument();
    expect(screen.getByText('demo@vacker.com')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(4);
    const entrar = screen.getAllByRole('link', { name: 'Entrar' });
    expect(entrar.map((a) => a.getAttribute('href'))).toEqual([
      '/tablero',
      '/tasador',
      '/todo',
      '/protocolo',
    ]);
  });

  it('el Protocolo queda apagado si la inmobiliaria no lo tiene contratado', () => {
    render(
      <HomeView
        sesion={{ email: 'demo@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: tenant() }}
      />,
    );
    const entrar = screen.getAllByRole('link', { name: 'Entrar' });
    expect(entrar.map((a) => a.getAttribute('href'))).not.toContain('/protocolo');
  });

  it('muestra el nombre de la inmobiliaria logueada, no uno hardcodeado', () => {
    render(
      <HomeView sesion={{ email: 'demo@sanso.com.ar', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: tenant({}, 'Sanso Propiedades') }} />,
    );
    expect(screen.getByRole('heading', { name: /Sanso Propiedades · Plataforma 2\.0/ })).toBeInTheDocument();
  });

  it('deshabilita el Tasador y el To Do si el tenant no los tiene habilitados', () => {
    render(
      <HomeView sesion={{ email: 'demo@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: tenant({ tasador: false, todo: false }) }} />,
    );
    const entrar = screen.getAllByRole('link', { name: 'Entrar' });
    expect(entrar.map((a) => a.getAttribute('href'))).toEqual(['/tablero']);
  });

  it('el plan no habilita módulos: mandan los checks del tenant', () => {
    const soloTablero = { ...tenant({ tasador: false, todo: false }), plan: 'enterprise' as const };
    render(<HomeView sesion={{ email: 'demo@vacker.com', nombre: 'Demo', fotoUrl: null, roles: ['vendedor'], tenant: soloTablero }} />);
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
