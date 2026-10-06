import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReclamoDto } from '@vacker/types';

const cambiarReclamo = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/alquileres/reclamos' }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/alquileres-api', () => ({
  cambiarReclamo: (...a: unknown[]) => cambiarReclamo(...a),
  listUsuariosAsignables: vi.fn().mockResolvedValue([{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Lucía Operadora' }]),
}));

import { ReclamoFicha } from './reclamo-ficha';

const R: ReclamoDto = {
  id: '33333333-3333-4333-8333-333333333333',
  numero: 7,
  asunto: 'Pérdida de agua en el baño',
  tipo: 'mantenimiento',
  prioridad: 'alta',
  estado: 'abierto',
  contrato: { id: '55555555-5555-4555-8555-555555555555', codigo: 'ALT-0005', propiedad: 'Mendoza 3340' },
  persona: { id: '11111111-1111-4111-8111-111111111111', nombre: 'Ana Inquilina' },
  asignadoA: null,
  abierto: '2026-10-06T12:00:00Z',
  actualizado: '2026-10-06T12:00:00Z',
  descripcion: 'Gotea la canilla de la ducha.',
  asignadoAId: null,
  abiertoPor: 'Javier',
  notas: [{ id: '66666666-6666-4666-8666-666666666666', en: '2026-10-06T12:00:00Z', usuario: 'Javier', texto: 'Abrió el reclamo (alta prioridad).' }],
};

describe('Reclamos (entrega 15)', () => {
  it('la ficha muestra el contrato, quién lo abrió y el historial', () => {
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('link', { name: 'ALT-0005 · Mendoza 3340' })).toHaveAttribute('href', '/alquileres/contratos/55555555-5555-4555-8555-555555555555');
    expect(screen.getByText('Abrió el reclamo (alta prioridad).')).toBeInTheDocument();
  });

  it('guardar manda solo lo que cambió, con la nota', async () => {
    cambiarReclamo.mockResolvedValueOnce(R);
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'en_curso' } });
    fireEvent.change(screen.getByLabelText(/^Nota/), { target: { value: 'Va el plomero el jueves.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(cambiarReclamo).toHaveBeenCalledWith('token', R.id, { estado: 'en_curso', nota: 'Va el plomero el jueves.' }));
  });
});
