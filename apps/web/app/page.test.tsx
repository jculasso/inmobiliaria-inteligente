import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home (shell de fundaciones)', () => {
  it('muestra el título y los tres módulos', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /Vacker · Plataforma 2\.0/ })).toBeInTheDocument();
    expect(screen.getByText('Tablero Comercial')).toBeInTheDocument();
    expect(screen.getByText('Tasador')).toBeInTheDocument();
    expect(screen.getByText('To Do List')).toBeInTheDocument();
  });

  it('marca el Tablero como Activo', () => {
    render(<Home />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });
});
