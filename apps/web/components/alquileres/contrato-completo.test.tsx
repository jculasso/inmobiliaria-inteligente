import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ContratoDto } from '@vacker/types';

const cargarCargosIngreso = vi.fn();
const extenderContrato = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/alquileres-api', () => ({
  cargarCargosIngreso: (...a: unknown[]) => cargarCargosIngreso(...a),
  extenderContrato: (...a: unknown[]) => extenderContrato(...a),
}));

import { CargosIngreso } from './cargos-ingreso';
import { ExtenderModal } from './extender-modal';

const C = '55555555-5555-4555-8555-555555555555';

describe('Contrato completo (entrega 14)', () => {
  it('propone los cargos, se suma un informe y se cargan', async () => {
    cargarCargosIngreso.mockResolvedValueOnce({});
    render(
      <CargosIngreso
        contratoId={C}
        estado="vigente"
        moneda="ARS"
        cargos={{
          cargados: false,
          valorTotal: 8_400_000,
          meses: 24,
          propuesta: [
            { tipo: 'comision', descripcion: 'Comisión inicial 1 de 2', aCargoDe: 'inquilino', importe: 254_100, vencimiento: '2026-02-20', moneda: null },
            { tipo: 'comision', descripcion: 'Comisión inicial 2 de 2', aCargoDe: 'inquilino', importe: 254_100, vencimiento: '2026-03-20', moneda: null },
          ],
        }}
      />,
    );
    expect(screen.getByText(/valor total \$ 8\.400\.000 · 24 meses/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '＋ Informe de garantía' }));
    const importes = screen.getAllByLabelText('Importe');
    fireEvent.change(importes[2]!, { target: { value: '30.000' } });
    expect(screen.getByText(/Total:/).parentElement).toHaveTextContent('$ 538.200');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar los cargos' }));
    await waitFor(() => expect(cargarCargosIngreso).toHaveBeenCalled());
    expect(cargarCargosIngreso.mock.calls[0]![2].map((c: { tipo: string; importe: number }) => [c.tipo, c.importe])).toEqual([
      ['comision', 254_100],
      ['comision', 254_100],
      ['informe', 30_000],
    ]);
  });

  it('ya cargados, no se proponen de nuevo', () => {
    render(<CargosIngreso contratoId={C} estado="vigente" moneda="ARS" cargos={{ cargados: true, valorTotal: 0, meses: 24, propuesta: [] }} />);
    expect(screen.getByText(/Cargados/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar los cargos' })).not.toBeInTheDocument();
  });

  it('extender: empieza al día siguiente del fin y por defecto suma 12 meses', async () => {
    extenderContrato.mockResolvedValueOnce({});
    const contrato = { id: C, codigo: 'ALT-0090', fin: '2026-10-31', ajuste: 'indexado', indice: 'ICL', periodicidadMeses: 4 } as ContratoDto;
    render(<ExtenderModal contrato={contrato} onClose={vi.fn()} onDone={vi.fn()} />);
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText(/La extensión empieza el 01\/11\/2026/)).toBeInTheDocument();
    fireEvent.click(dialogo.getByRole('button', { name: /Extender hasta el 31\/10\/2027/ }));
    await waitFor(() => expect(extenderContrato).toHaveBeenCalledWith('token', C, { nuevoFin: '2027-10-31', importeBase: null }));
  });
});
