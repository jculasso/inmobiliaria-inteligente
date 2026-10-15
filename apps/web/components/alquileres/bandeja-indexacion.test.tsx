import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BandejaIndexacionDto, IndexacionDto } from '@vacker/types';

const confirmarIndexacion = vi.fn();
const previsualizarDiferencias = vi.fn().mockResolvedValue({ diferencias: null });
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  confirmarIndexacion: (...a: unknown[]) => confirmarIndexacion(...a),
  previsualizarDiferencias: (...a: unknown[]) => previsualizarDiferencias(...a),
}));

import { BandejaIndexacion, textoDiferencias } from './bandeja-indexacion';

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
    expect(
      screen.getByText(/IPC de marzo de 2026: 11\.077,0608 → IPC de julio de 2026: 12\.076,3937/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar $ 1.137.518,00' })).toBeInTheDocument();
  });

  // Regla 7: lo que espera un índice va aparte y no se puede confirmar.
  it('un tramo sin índice va en «Esperando el índice», sin botón', () => {
    render(
      <BandejaIndexacion
        bandeja={bandeja([
          t({
            estado: 'pendiente_indice',
            importePropuesto: null,
            falta: ['el IPC de julio de 2026'],
          }),
        ])}
      />,
    );
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
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Contrato 5: el tramo 4 quedó en $ 1.137.518,00.',
      ),
    );
    expect(confirmarIndexacion).toHaveBeenCalledWith('token', tramo.tramoId, null);
  });

  it('Casa Propia pide el importe antes de confirmar', async () => {
    confirmarIndexacion.mockClear();
    render(
      <BandejaIndexacion
        bandeja={bandeja([
          t({
            indice: 'CCP',
            estado: 'manual',
            fechaBase: null,
            fechaRequerida: null,
            importePropuesto: null,
          }),
        ])}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cargá el importe del tramo.');
    expect(confirmarIndexacion).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Importe del tramo 4/), {
      target: { value: '1.150.000' },
    });
    confirmarIndexacion.mockResolvedValueOnce({ tramoId: 'x', numero: 4, importe: 1_150_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(confirmarIndexacion).toHaveBeenCalledWith('token', expect.any(String), 1_150_000),
    );
  });

  it('la alerta de un índice que no se actualiza se ve arriba', () => {
    render(
      <BandejaIndexacion
        bandeja={bandeja([], 'El ICL no trae valores nuevos desde el 05/10/2026.')}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('El ICL no trae valores nuevos');
    expect(
      screen.getByText(/No hay tramos para indexar en los próximos 30 días/),
    ).toBeInTheDocument();
  });

  describe('liquidación final (regla 137)', () => {
    const diferencias = {
      moneda: 'ARS' as const,
      periodos: ['2026-10'],
      inquilino: 57_269.17,
      propietarios: 50_503.34,
      vencimiento: '2026-10-20',
      conceptos: 6,
    };

    it('regla 137: con meses cobrados como parcial, primero muestra qué diferencias se van a generar', async () => {
      confirmarIndexacion.mockClear();
      previsualizarDiferencias.mockResolvedValueOnce({ diferencias });
      confirmarIndexacion.mockResolvedValueOnce({
        tramoId: 'x',
        numero: 4,
        importe: 1_137_518,
        diferencias,
      });
      const tramo = t();
      render(<BandejaIndexacion bandeja={bandeja([tramo])} />);
      fireEvent.click(screen.getByRole('button', { name: /Confirmar \$/ }));
      expect(
        await screen.findByText(
          'Se van a generar las diferencias de octubre de 2026: inquilino $ 57.269,17, propietario $ 50.503,34. Vencen el 20/10/2026.',
        ),
      ).toBeInTheDocument();
      // Todavía no confirmó nada.
      expect(previsualizarDiferencias).toHaveBeenCalledWith('token', tramo.tramoId, null);
      expect(confirmarIndexacion).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y generar las diferencias' }));
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Contrato 5: el tramo 4 quedó en $ 1.137.518,00. Se generó la liquidación final de octubre de 2026.',
        ),
      );
      expect(confirmarIndexacion).toHaveBeenCalledWith('token', tramo.tramoId, null);
    });

    it('regla 137: «Volver» no confirma', async () => {
      confirmarIndexacion.mockClear();
      previsualizarDiferencias.mockResolvedValueOnce({ diferencias });
      render(<BandejaIndexacion bandeja={bandeja([t()])} />);
      fireEvent.click(screen.getByRole('button', { name: /Confirmar \$/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));
      expect(screen.getByRole('button', { name: /Confirmar \$/ })).toBeInTheDocument();
      expect(confirmarIndexacion).not.toHaveBeenCalled();
    });

    it('regla 134: si el definitivo es menor, dice que se le devuelve al inquilino y que el propietario devuelve', () => {
      expect(
        textoDiferencias({
          ...diferencias,
          periodos: ['2026-09', '2026-10'],
          inquilino: -5_449.77,
          propietarios: -4_805.92,
        }),
      ).toBe(
        'Se van a generar las diferencias de septiembre de 2026 y octubre de 2026: inquilino $ 5.449,77 a su favor, propietario devuelve $ 4.805,92. Vencen el 20/10/2026.',
      );
    });
  });
});
