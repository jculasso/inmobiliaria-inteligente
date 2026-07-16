import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, Button, Card, CardTitle } from './index';

describe('Button', () => {
  it('renderiza como <button type="button"> por defecto', () => {
    render(<Button>Guardar</Button>);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('con asChild renderiza el elemento hijo (Slot)', () => {
    render(
      <Button asChild>
        <a href="/tablero">Ir al tablero</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Ir al tablero' });
    expect(link).toHaveAttribute('href', '/tablero');
  });
});

describe('Card', () => {
  it('renderiza el título', () => {
    render(
      <Card>
        <CardTitle>Tablero Comercial</CardTitle>
      </Card>,
    );
    expect(screen.getByText('Tablero Comercial')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('usa la etiqueta por defecto según la variante', () => {
    render(<Badge variant="dev" />);
    expect(screen.getByText('En desarrollo')).toBeInTheDocument();
  });

  it('permite sobrescribir el texto con children', () => {
    render(<Badge variant="activo">Online</Badge>);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});
