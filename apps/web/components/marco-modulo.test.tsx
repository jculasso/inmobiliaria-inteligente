import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuthPrincipal } from '@vacker/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/alquileres', redirect: vi.fn() }));
vi.mock('../lib/api', () => ({ getMe: vi.fn(), MeError: class extends Error {} }));
vi.mock('../lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('../lib/supabase/client', () => ({ createClient: vi.fn() }));

import { MarcoModulo } from './marco-modulo';

const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'javier@alteva.com.ar',
  nombre: 'Javier',
  fotoUrl: null,
  tenantId: '22222222-2222-4222-8222-222222222222',
  roles: ['direccion'],
  debeCambiarPassword: false,
  tenant: {
    nombre: 'Alteva',
    plan: 'pro',
    modulos: { alquileres: true },
    config: {},
  },
} as unknown as AuthPrincipal;

/*
 * jsdom no aplica el CSS, así que esto no mide la altura: fija las clases que
 * la hacen compacta en el teléfono y el nombre del botón de ícono. La medida
 * se hace en el navegador (skill `verificar-ui`).
 */
describe('MarcoModulo — cabecera', () => {
  it('en el teléfono el email se esconde y queda el avatar; desde sm, se ve', () => {
    render(
      <MarcoModulo principal={principal} titulo="Alquileres">
        <p>contenido</p>
      </MarcoModulo>,
    );
    const email = screen.getByText('javier@alteva.com.ar');
    expect(email).toHaveClass('hidden', 'sm:inline');
    expect(screen.getByTitle('javier@alteva.com.ar')).toBeInTheDocument();
  });

  it('«Cerrar sesión» es un botón de ícono de 40px con su nombre accesible', () => {
    render(
      <MarcoModulo principal={principal} titulo="Alquileres">
        <p>contenido</p>
      </MarcoModulo>,
    );
    const salir = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(salir).toHaveClass('max-sm:h-10', 'max-sm:w-10');
    expect(salir.querySelector('svg')).toHaveClass('sm:hidden');
    expect(screen.getByText('Cerrar sesión')).toHaveClass('max-sm:hidden');
  });
});
