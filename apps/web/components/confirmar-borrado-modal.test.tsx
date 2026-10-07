import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmarBorradoModal } from './confirmar-borrado-modal';

describe('ConfirmarBorradoModal', () => {
  const props = {
    titulo: 'Borrar X',
    descripcion: 'd',
    detalle: null,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it('por defecto confirma con «Sí, borrar»', () => {
    render(<ConfirmarBorradoModal {...props} />);
    expect(screen.getByRole('button', { name: 'Sí, borrar' })).toBeInTheDocument();
  });

  it('«Quitar …» confirma con «Sí, quitar», no con «Sí, borrar» (prueba del 7/10/2026)', () => {
    render(
      <ConfirmarBorradoModal
        {...props}
        titulo="Quitar API de esta propiedad"
        verbo={{ boton: 'Sí, quitar', enCurso: 'Quitando…' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sí, quitar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, borrar' })).toBeNull();
  });
});
