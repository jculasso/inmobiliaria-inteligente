import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContratoDto } from '@vacker/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
const cambiarEstadoContrato = vi.fn();
vi.mock('../../lib/alquileres-api', () => ({ cambiarEstadoContrato: (...a: unknown[]) => cambiarEstadoContrato(...a) }));

import { ContratoFicha } from './contrato-ficha';

const base: ContratoDto = {
  id: 'c1',
  codigo: '25',
  estado: 'borrador',
  tipo: 'comercial',
  moneda: 'ARS',
  inicio: '2024-11-01',
  fin: '2026-10-31',
  fechaFirma: null,
  diaVencimiento: 5,
  diaPagoPropietario: 10,
  ajuste: 'indexado',
  indice: 'ICL',
  periodicidadMeses: 4,
  honorariosPct: 2.48,
  gastosAdmPct: 2,
  ivaPct: 0,
  punitorioDiarioPct: 0.5,
  pagoGarantizado: false,
  depositoImporte: null,
  depositoMoneda: null,
  depositoDevolucion: null,
  rescindidoEl: null,
  obs: null,
  registrado: { en: '2026-10-06T15:00:00Z', por: 'Lucía Operadora' },
  anulado: null,
  propiedad: { id: 'p', direccion: 'Calle 123', unidad: null, ciudad: 'Rosario' },
  partes: [],
  tramos: [
    { numero: 1, desde: '2024-11-01', hasta: '2025-02-28', importe: 250_000, confirmadoEl: null, indiceBase: null, indiceRequerido: null, importePropuesto: null },
    { numero: 2, desde: '2025-03-01', hasta: '2025-06-30', importe: null, confirmadoEl: null, indiceBase: null, indiceRequerido: null, importePropuesto: null },
  ],
};

beforeEach(() => cambiarEstadoContrato.mockReset());

describe('ContratoFicha — acciones según el estado (reglas 2 y 3)', () => {
  it('en borrador: editar y activar; no se puede rescindir', () => {
    render(<ContratoFicha contrato={base} />);
    expect(screen.getByRole('button', { name: 'Activar contrato' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '✏️ Editar' })).toHaveAttribute('href', '/alquileres/contratos/c1/editar');
    expect(screen.queryByRole('button', { name: 'Rescindir' })).not.toBeInTheDocument();
  });

  it('vigente: finalizar o rescindir; ya no se edita', () => {
    render(<ContratoFicha contrato={{ ...base, estado: 'vigente' }} />);
    expect(screen.getByRole('button', { name: 'Rescindir' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '✏️ Editar' })).not.toBeInTheDocument();
  });

  it('rescindir pide la fecha y la manda', async () => {
    cambiarEstadoContrato.mockResolvedValue({});
    render(<ContratoFicha contrato={{ ...base, estado: 'vigente' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Rescindir' }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByRole('button', { name: 'Rescindir' })).toBeDisabled();
    await userEvent.type(dialogo.getByLabelText(/Fecha de rescisión/), '2025-06-30');
    await userEvent.click(dialogo.getByRole('button', { name: 'Rescindir' }));
    expect(cambiarEstadoContrato).toHaveBeenCalledWith('token', 'c1', { estado: 'rescindido', fecha: '2025-06-30' });
  });

  it('un tramo sin indexar se marca, no se muestra en cero', () => {
    render(<ContratoFicha contrato={base} />);
    expect(screen.getByText('$ 250.000,00')).toBeInTheDocument();
    expect(screen.getByText('A indexar')).toBeInTheDocument();
  });
});
