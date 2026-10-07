import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReclamoDto } from '@vacker/types';

const cambiarReclamo = vi.fn();
const crearReclamo = vi.fn();
const VENDEDOR = '77777777-7777-4777-8777-777777777777';
const PLOMERO = '88888888-8888-4888-8888-888888888888';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/alquileres/reclamos',
}));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  cambiarReclamo: (...a: unknown[]) => cambiarReclamo(...a),
  crearReclamo: (...a: unknown[]) => crearReclamo(...a),
  listUsuariosAsignables: vi
    .fn()
    .mockResolvedValue([{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Lucía Operadora' }]),
  listProveedores: vi.fn().mockResolvedValue([
    {
      id: '88888888-8888-4888-8888-888888888888',
      nombre: 'Juan Plomero',
      rubro: 'plomero',
      telefono: '341 555-1234',
      email: 'juan@plomeria.com',
    },
  ]),
}));

import { ReclamoFicha } from './reclamo-ficha';
import { ReclamosLista } from './reclamos-lista';
import { NuevoReclamoModal } from './reclamos-piezas';

const R: ReclamoDto = {
  id: '33333333-3333-4333-8333-333333333333',
  numero: 7,
  asunto: 'Pérdida de agua en el baño',
  tipo: 'mantenimiento',
  prioridad: 'alta',
  estado: 'abierto',
  contrato: {
    id: '55555555-5555-4555-8555-555555555555',
    codigo: 'ALT-0005',
    propiedad: 'Mendoza 3340',
  },
  persona: { id: '11111111-1111-4111-8111-111111111111', nombre: 'Ana Inquilina' },
  asignadoA: null,
  proveedor: null,
  abierto: '2026-10-06T12:00:00Z',
  actualizado: '2026-10-06T12:00:00Z',
  descripcion: 'Gotea la canilla de la ducha.',
  asignadoAId: null,
  abiertoPor: 'Javier',
  notas: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      en: '2026-10-06T12:00:00Z',
      usuario: 'Javier',
      texto: 'Abrió el reclamo (alta prioridad).',
    },
  ],
};

describe('Reclamos (entrega 15)', () => {
  it('la ficha muestra el contrato, quién lo abrió y el historial', () => {
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('link', { name: 'ALT-0005 · Mendoza 3340' })).toHaveAttribute(
      'href',
      '/alquileres/contratos/55555555-5555-4555-8555-555555555555',
    );
    expect(screen.getByText('Abrió el reclamo (alta prioridad).')).toBeInTheDocument();
  });

  // Un reclamo abierto a las 23 h de Argentina ya es «mañana» en UTC: la fecha sale del día argentino.
  it('abierto de noche, la fecha es la del día en Argentina', () => {
    render(<ReclamoFicha reclamo={{ ...R, abierto: '2026-10-07T02:00:00Z' }} />);
    expect(screen.getByText(/^06\/10\/2026/)).toBeInTheDocument();
  });

  it('sin notas, lo dice', () => {
    render(<ReclamoFicha reclamo={{ ...R, notas: [] }} />);
    expect(screen.getByText('Sin notas todavía.')).toBeInTheDocument();
  });

  // La fila de la tabla se abre con un clic, que el teclado no alcanza: el número es un link de verdad.
  it('en la lista, cada reclamo se abre también con el teclado', () => {
    const resumen = {
      id: R.id,
      numero: 7,
      asunto: R.asunto,
      tipo: R.tipo,
      prioridad: R.prioridad,
      estado: R.estado,
      contrato: R.contrato,
      persona: R.persona,
      asignadoA: null,
      proveedor: null,
      abierto: R.abierto,
      actualizado: R.actualizado,
    };
    render(<ReclamosLista reclamos={[resumen]} contratos={[]} estado="abiertos" />);
    expect(
      screen.getByRole('link', { name: 'Reclamo 7: Pérdida de agua en el baño' }),
    ).toHaveAttribute('href', `/alquileres/reclamos/${R.id}`);
    expect(screen.getByRole('button', { name: 'Abiertos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('guardar manda solo lo que cambió, con la nota', async () => {
    cambiarReclamo.mockResolvedValueOnce(R);
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'en_curso' } });
    fireEvent.change(screen.getByLabelText(/^Nota/), {
      target: { value: 'Va el plomero el jueves.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cambiarReclamo).toHaveBeenCalledWith('token', R.id, {
        estado: 'en_curso',
        nota: 'Va el plomero el jueves.',
      }),
    );
  });
});

// Javier, 7/10/2026: «los reclamos se los asignás a los vendedores, eso está mal».
describe('Reclamos · quién lo sigue y el proveedor (reglas 60 a 66)', () => {
  const PROVEEDOR = {
    id: PLOMERO,
    nombre: 'Juan Plomero',
    telefono: '341 555-1234',
    email: 'juan@plomeria.com',
  };

  it('regla 60: el reclamo nuevo pide «Lo sigue» y «Proveedor», y los manda', async () => {
    crearReclamo.mockResolvedValueOnce({ id: R.id });
    render(
      <NuevoReclamoModal
        contratos={[]}
        contratoFijo={R.contrato!.id}
        onClose={vi.fn()}
        onCreado={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Lo sigue')).toHaveDisplayValue('Sin asignar');
    expect(screen.getByLabelText('Proveedor')).toHaveDisplayValue('Sin proveedor');
    expect(screen.queryByText('Asignado a')).not.toBeInTheDocument();
    await screen.findByRole('option', { name: 'Juan Plomero' });
    fireEvent.change(screen.getByLabelText(/^Asunto/), { target: { value: 'Pérdida de agua' } });
    fireEvent.change(screen.getByLabelText('Lo sigue'), {
      target: { value: '44444444-4444-4444-8444-444444444444' },
    });
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: PLOMERO } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el reclamo' }));
    await waitFor(() =>
      expect(crearReclamo).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          asignadoAId: '44444444-4444-4444-8444-444444444444',
          proveedorId: PLOMERO,
        }),
      ),
    );
  });

  it('regla 63: un reclamo de un vendedor muestra su nombre marcado, y guardar otra cosa no lo toca', async () => {
    cambiarReclamo.mockResolvedValue(R);
    render(<ReclamoFicha reclamo={{ ...R, asignadoAId: VENDEDOR, asignadoA: 'Pedro Vendedor' }} />);
    const loSigue = screen.getByLabelText('Lo sigue');
    await screen.findByRole('option', { name: 'Pedro Vendedor · no usa Alquileres' });
    expect(loSigue).toHaveDisplayValue('Pedro Vendedor · no usa Alquileres');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'en_curso' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cambiarReclamo).toHaveBeenLastCalledWith('token', R.id, {
        estado: 'en_curso',
        nota: null,
      }),
    );
    fireEvent.change(loSigue, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cambiarReclamo).toHaveBeenLastCalledWith(
        'token',
        R.id,
        expect.objectContaining({ asignadoAId: null }),
      ),
    );
  });

  it('regla 66: la ficha muestra el proveedor con su teléfono y su email para llamarlo', () => {
    render(<ReclamoFicha reclamo={{ ...R, proveedor: PROVEEDOR }} />);
    expect(screen.getByRole('link', { name: /341 555-1234/ })).toHaveAttribute(
      'href',
      'tel:3415551234',
    );
    expect(screen.getByRole('link', { name: /juan@plomeria.com/ })).toHaveAttribute(
      'href',
      'mailto:juan@plomeria.com',
    );
  });

  it('regla 66: la lista muestra el proveedor y «Sin proveedor», en la tabla y en las tarjetas', () => {
    const resumen = (id: string, proveedor: typeof PROVEEDOR | null) => ({
      ...R,
      id,
      proveedor,
    });
    render(
      <ReclamosLista
        reclamos={[resumen(R.id, PROVEEDOR), resumen('99999999-9999-4999-8999-999999999999', null)]}
        contratos={[]}
        estado="abiertos"
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Proveedor' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Lo sigue' })).toBeInTheDocument();
    expect(screen.getAllByText('Juan Plomero')).toHaveLength(2);
    expect(screen.getAllByText('Sin proveedor')).toHaveLength(2);
  });
});
