import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BandejaIndexacionDto, IndexacionDto } from '@vacker/types';

const confirmarIndexacion = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/alquileres-api', () => ({ confirmarIndexacion: (...a: unknown[]) => confirmarIndexacion(...a) }));

import { BandejaIndexacion } from './bandeja-indexacion';

/* Contrato #5 de Gexion: tramo 4 desde el 15/08/2026, IPC de marzo → julio. */
const t = (over: Partial<IndexacionDto> = {}): IndexacionDto => ({
  tramoId: crypto.randomUUID(),
  contrato: { id: crypto.randomUUID(), codigo: '5', direccion: 'Calle 1', unidad: null },
  inquilinos: ['Inquilino'],
  indice: 'IPC',
  numero: 4,
  desde: '2026-08-15',
  hasta: '2026-12-14',
  importeAnterior: 1_043_387,
  estado: 'lista',
  fechaBase: '2026-03-01',
  valorBase: 11_077.0608,
  fechaRequerida: '2026-07-01',
  valorRequerido: 12_076.3937,
  importePropuesto: 1_137_518,
  falta: [],
  vencida: false,
  ...over,
});

const bandeja = (tramos: IndexacionDto[], alerta: string | null = null): BandejaIndexacionDto => ({
  indices: [
    { indice: 'ICL', ultimaFecha: '2026-10-16', alerta },
    { indice: 'IPC', ultimaFecha: '2026-08-01', alerta: null },
  ],
  tramos,
});

describe('BandejaIndexacion', () => {
  it('muestra la propuesta con los índices usados, y el botón dice el importe', () => {
    render(<BandejaIndexacion bandeja={bandeja([t()])} />);
    expect(screen.getByText(/IPC de marzo de 2026: 11\.077,0608 → IPC de julio de 2026: 12\.076,3937/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar $ 1.137.518' })).toBeInTheDocument();
  });

  // Regla 7: lo que espera un índice va aparte y no se puede confirmar.
  it('un tramo sin índice va en «Esperando el índice», sin botón', () => {
    render(<BandejaIndexacion bandeja={bandeja([t({ estado: 'pendiente_indice', importePropuesto: null, falta: ['el IPC de julio de 2026'] })])} />);
    const seccion = screen.getByRole('heading', { name: /Esperando el índice · 1/ }).parentElement!;
    expect(within(seccion).getByText(/Falta el IPC de julio de 2026/)).toBeInTheDocument();
    expect(within(seccion).queryByRole('button')).not.toBeInTheDocument();
  });

  // Regla 6: lo que viaja al confirmar un índice con fuente es nada; la API calcula.
  it('confirmar no manda importe para un índice con fuente', async () => {
    confirmarIndexacion.mockResolvedValueOnce({ tramoId: 'x', numero: 4, importe: 1_137_518 });
    const tramo = t();
    render(<BandejaIndexacion bandeja={bandeja([tramo])} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Contrato 5: el tramo 4 quedó en $ 1.137.518.'));
    expect(confirmarIndexacion).toHaveBeenCalledWith('token', tramo.tramoId, null);
  });

  it('Casa Propia pide el importe antes de confirmar', async () => {
    confirmarIndexacion.mockClear();
    render(<BandejaIndexacion bandeja={bandeja([t({ indice: 'CCP', estado: 'manual', fechaBase: null, fechaRequerida: null, importePropuesto: null })])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cargá el importe del tramo.');
    expect(confirmarIndexacion).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Importe del tramo 4/), { target: { value: '1.150.000' } });
    confirmarIndexacion.mockResolvedValueOnce({ tramoId: 'x', numero: 4, importe: 1_150_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(confirmarIndexacion).toHaveBeenCalledWith('token', expect.any(String), 1_150_000));
  });

  it('la alerta de un índice que no se actualiza se ve arriba', () => {
    render(<BandejaIndexacion bandeja={bandeja([], 'El ICL no trae valores nuevos desde el 05/10/2026.')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('El ICL no trae valores nuevos');
    expect(screen.getByText(/No hay tramos para indexar en los próximos 30 días/)).toBeInTheDocument();
  });
});
