import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelAlertas, type AlertaConPropiedad } from './panel-alertas';

const ALERTAS: AlertaConPropiedad[] = [
  {
    nivel: 'roja',
    titulo: '3 acciones atrasadas',
    detalle: 'Vencieron sin cerrarse.',
    protocoloId: 'p1',
    direccion: 'Córdoba 1234',
  },
  {
    nivel: 'ambar',
    titulo: 'Autorización por vencer',
    detalle: 'Vence el 2026-08-01 (7 días).',
    protocoloId: 'p2',
    direccion: 'Mitre 500',
  },
  {
    nivel: 'ambar',
    titulo: 'Sin actividad reciente',
    detalle: 'Pasaron 9 días.',
    protocoloId: 'p2',
    direccion: 'Mitre 500',
  },
];

describe('PanelAlertas', () => {
  it('arranca colapsado, mostrando el total y el desglose por urgencia', () => {
    render(<PanelAlertas alertas={ALERTAS} />);

    expect(screen.getByText('3 alertas')).toBeInTheDocument();
    expect(screen.getByText('1 urgente · 2 para revisar')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    // El detalle no se muestra hasta expandir.
    expect(screen.queryByText(/Vencieron sin cerrarse/)).not.toBeInTheDocument();
  });

  it('expande con un click y vuelve a cerrar con otro', async () => {
    const user = userEvent.setup();
    render(<PanelAlertas alertas={ALERTAS} />);
    const boton = screen.getByRole('button');

    await user.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Vencieron sin cerrarse/)).toBeInTheDocument();

    await user.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Vencieron sin cerrarse/)).not.toBeInTheDocument();
  });

  it('cada alerta expandida linkea a su propiedad y antepone la dirección', async () => {
    const user = userEvent.setup();
    render(<PanelAlertas alertas={ALERTAS} />);
    await user.click(screen.getByRole('button'));

    const link = screen.getByRole('link', { name: /Córdoba 1234 · 3 acciones atrasadas/ });
    expect(link).toHaveAttribute('href', '/protocolo/p1');
  });

  it('usa singular con una sola alerta', () => {
    render(<PanelAlertas alertas={[ALERTAS[0]!]} />);
    expect(screen.getByText('1 alerta')).toBeInTheDocument();
    expect(screen.getByText('1 urgente')).toBeInTheDocument();
  });

  it('sin alertas dice "Todo al día" y no ofrece expandir', () => {
    render(<PanelAlertas alertas={[]} />);
    expect(screen.getByText('Todo al día')).toBeInTheDocument();
    expect(screen.queryByText('▾')).not.toBeInTheDocument();
  });
});
