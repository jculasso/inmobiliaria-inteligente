import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ModulosTenant } from '@vacker/types';
import { MenuModulos } from './menu-modulos';

let pathname = '/tablero';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const modulos = (habilitados: Partial<ModulosTenant>): ModulosTenant =>
  ({
    tablero: false,
    tasador: false,
    todo: false,
    protocolo: false,
    publicacion: false,
    alquileres: false,
    ...habilitados,
  }) as ModulosTenant;

describe('MenuModulos', () => {
  it('ofrece volver al Inicio, primero en la lista', async () => {
    render(<MenuModulos modulos={modulos({ tablero: true, tasador: true })} />);
    await userEvent.click(screen.getByRole('button', { name: /Módulos/ }));

    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Inicio');
    expect(items[0]).toHaveAttribute('href', '/');
    expect(items).toHaveLength(3);
  });

  /**
   * Con un solo módulo el menú no se mostraba, y el único camino a la Home era
   * el logo chico de la barra.
   */
  it('con un solo módulo contratado igual se muestra, para poder volver al Inicio', async () => {
    render(<MenuModulos modulos={modulos({ alquileres: true })} />);
    await userEvent.click(screen.getByRole('button', { name: /Módulos/ }));
    expect(screen.getByRole('menuitem', { name: /Inicio/ })).toHaveAttribute('href', '/');
  });

  it('marca el módulo en el que se está', async () => {
    pathname = '/tablero/ventas';
    render(<MenuModulos modulos={modulos({ tablero: true, tasador: true })} />);
    await userEvent.click(screen.getByRole('button', { name: /Módulos/ }));
    expect(screen.getByRole('menuitem', { name: /Tablero/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('menuitem', { name: /Inicio/ })).not.toHaveAttribute('aria-current');
  });
});
