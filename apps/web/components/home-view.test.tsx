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
    expect(screen.getByRole('heading', { name: 'Vacker' })).toBeInTheDocument();
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

  it('un módulo no contratado se muestra "No incluido", no "Activo"', () => {
    // Regresión: el badge reflejaba la madurez del módulo, así que una
    // inmobiliaria sin el Protocolo lo veía igual de verde que los contratados.
    render(
      <HomeView
        sesion={{
          email: 'demo@sanso.com.ar',
          nombre: 'Demo',
          fotoUrl: null,
          roles: ['vendedor'],
          tenant: tenant({ tasador: true, todo: true, protocolo: false, publicacion: false }),
        }}
      />,
    );
    expect(screen.getAllByText('Activo')).toHaveLength(3);
    expect(screen.getByText('No incluido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No contratado' })).toBeDisabled();
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
    expect(screen.getByRole('heading', { name: 'Sanso Propiedades' })).toBeInTheDocument();
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

/**
 * De quién es la marca en esta pantalla.
 *
 * Sin sesión no hay tenant, así que el override de marca no se aplicaba y todo
 * caía al valor por defecto de `--color-brand-red`, que es el rojo de Vacker: el
 * botón «Ingresar», el filete de la tarjeta y el rótulo «ACCESO» salían rojos. A
 * un cliente nuevo lo primero que le mostrábamos era la marca de otro.
 *
 * El riesgo del arreglo es el opuesto —pisar la marca del cliente que sí pagó
 * por verla—, y eso es lo que cuidan estos cuatro casos.
 */
describe('HomeView · de quién es la marca', () => {
  const marcaDe = (contenedor: HTMLElement) =>
    contenedor.querySelector('main')!.getAttribute('style') ?? '';

  it('sin sesión, la marca es la de la plataforma', () => {
    const { container } = render(<HomeView sesion={null} />);
    expect(marcaDe(container)).toContain('--color-plataforma');
  });

  it('con sesión, el color del cliente le gana a la plataforma', () => {
    const conColor = {
      ...tenant(),
      config: { colorPrimario: '#C1121F', colorPrimarioOscuro: '#8F0D18' },
    };
    const { container } = render(
      <HomeView
        sesion={{
          email: 'demo@vacker.com',
          nombre: 'Demo',
          fotoUrl: null,
          roles: ['vendedor'],
          tenant: conColor,
        }}
      />,
    );
    const marca = marcaDe(container);
    expect(marca).toContain('#C1121F');
    expect(marca, 'la marca del cliente quedó pisada por la de la plataforma').not.toContain(
      '--color-plataforma',
    );
  });

  it('con sesión y sin color propio, no fuerza el azul de la plataforma', () => {
    // El tenant que no cargó su color se queda con el valor por defecto del
    // sistema de diseño. Meterle el azul acá sería decidir por él.
    const { container } = render(
      <HomeView
        sesion={{
          email: 'demo@vacker.com',
          nombre: 'Demo',
          fotoUrl: null,
          roles: ['vendedor'],
          tenant: tenant(),
        }}
      />,
    );
    expect(marcaDe(container)).not.toContain('--color-plataforma');
  });

  it('el rótulo «Inmobiliaria Inteligente» va en azul con sesión y sin ella', () => {
    // Es el nombre de la plataforma, no el de la inmobiliaria: es la única
    // línea de la pantalla que no cambia de un cliente a otro.
    //
    // Se busca el <p> y no por texto: sin sesión el nombre de la inmobiliaria
    // TAMBIÉN es «Inmobiliaria Inteligente», así que hay dos coincidencias.
    const rotulo = (contenedor: HTMLElement) =>
      [...contenedor.querySelectorAll('p')].find(
        (e) => e.textContent?.trim() === 'Inmobiliaria Inteligente',
      );

    const sinSesion = render(<HomeView sesion={null} />);
    expect(rotulo(sinSesion.container)).toHaveClass('text-plataforma');
    sinSesion.unmount();

    const conSesion = render(
      <HomeView
        sesion={{
          email: 'demo@vacker.com',
          nombre: 'Demo',
          fotoUrl: null,
          roles: ['vendedor'],
          tenant: { ...tenant(), config: { colorPrimario: '#C1121F' } },
        }}
      />,
    );
    expect(rotulo(conSesion.container)).toHaveClass('text-plataforma');
  });
});
