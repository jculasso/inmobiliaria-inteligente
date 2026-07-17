import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModuleCard } from './module-card';

describe('ModuleCard', () => {
  it('en modo bloqueada no muestra badge ni acción, solo el mensaje de login', () => {
    render(
      <ModuleCard
        nombre="Tablero Comercial"
        descripcion="KPIs y ranking."
        icono="📊"
        estado="activo"
        href="/tablero"
        bloqueada
      />,
    );
    expect(screen.getByText(/Iniciá sesión para ver más/)).toBeInTheDocument();
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('desbloqueada y habilitada muestra el badge y el link de Entrar', () => {
    render(
      <ModuleCard
        nombre="Tablero Comercial"
        descripcion="KPIs y ranking."
        icono="📊"
        estado="activo"
        href="/tablero"
        bloqueada={false}
        habilitado
      />,
    );
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/tablero');
  });

  it('desbloqueada pero sin alcance muestra "No disponible"', () => {
    render(
      <ModuleCard
        nombre="Tablero Comercial"
        descripcion="KPIs y ranking."
        icono="📊"
        estado="activo"
        href="/tablero"
        bloqueada={false}
        habilitado={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'No disponible' })).toBeDisabled();
  });

  it('un módulo en desarrollo nunca ofrece Entrar aunque esté desbloqueado', () => {
    render(
      <ModuleCard
        nombre="Tasador"
        descripcion="Valuación asistida."
        icono="🏷️"
        estado="dev"
        href={null}
        bloqueada={false}
        habilitado
      />,
    );
    expect(screen.getByRole('button', { name: 'No disponible' })).toBeInTheDocument();
  });
});
