import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConfiguracionAlquileres } from '@vacker/types';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
const guardarConfiguracionAlquileres = vi.fn();
vi.mock('../../lib/alquileres-api', () => ({
  guardarConfiguracionAlquileres: (...a: unknown[]) => guardarConfiguracionAlquileres(...a),
}));

import { ConfiguracionForm } from './configuracion-form';

const INICIAL: ConfiguracionAlquileres = {
  ivaHonorariosPct: 21,
  comisionInicialPct: 5,
  comisionInicialCuotas: 2,
  comisionInicialConIva: true,
  selladoViviendaPct: 0,
  selladoComercialPct: 1,
  selladoComercialMipymePct: 0.25,
  selladoInquilinoPct: 100,
  depositoGestion: 'entrega_propietario',
  contratoHonorariosPct: 8,
  contratoGastosAdmPct: 2,
  contratoPunitorioDiarioPct: 0,
  contratoDiaVencimiento: 5,
  contratoDiaPagoPropietario: 10,
  diasDiferenciaFinal: 5,
};

beforeEach(() => guardarConfiguracionAlquileres.mockReset());

describe('ConfiguracionForm — Entrega A de Vacker (Florencia, 15/10/2026)', () => {
  it('regla 99: guarda lo que se propone en cada contrato nuevo', async () => {
    guardarConfiguracionAlquileres.mockImplementation(async (_t, c) => c);
    render(<ConfiguracionForm inicial={INICIAL} />);
    const punitorio = screen.getByLabelText(/Punitorio diario/);
    await userEvent.clear(punitorio);
    await userEvent.type(punitorio, '0,3');
    const vence = screen.getByLabelText(/Vence el día/);
    await userEvent.clear(vence);
    await userEvent.type(vence, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(guardarConfiguracionAlquileres.mock.calls[0]![1]).toMatchObject({
      contratoPunitorioDiarioPct: 0.3,
      contratoDiaVencimiento: 6,
      contratoHonorariosPct: 8,
      contratoDiaPagoPropietario: 10,
    });
  });

  it('regla 99: un día de vencimiento se queda entre 1 y 28, y se puede borrar para escribir otro', async () => {
    guardarConfiguracionAlquileres.mockImplementation(async (_t, c) => c);
    render(<ConfiguracionForm inicial={INICIAL} />);
    const paga = screen.getByLabelText(/Se paga el día/);
    await userEvent.clear(paga);
    await userEvent.type(paga, '31');
    await userEvent.tab();
    expect(paga).toHaveValue('28');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(guardarConfiguracionAlquileres.mock.calls[0]![1].contratoDiaPagoPropietario).toBe(28);
  });

  it('regla 103: el sellado se configura por tipo de contrato', async () => {
    guardarConfiguracionAlquileres.mockImplementation(async (_t, c) => c);
    render(<ConfiguracionForm inicial={INICIAL} />);
    expect(screen.getByLabelText(/Particular/)).toHaveValue('0');
    expect(screen.getByLabelText(/^Comercial \(%\)/)).toHaveValue('1');
    expect(screen.getByLabelText(/Comercial MiPyme/)).toHaveValue('0,25');
    const mipyme = screen.getByLabelText(/Comercial MiPyme/);
    await userEvent.clear(mipyme);
    await userEvent.type(mipyme, '0,5');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(guardarConfiguracionAlquileres.mock.calls[0]![1]).toMatchObject({
      selladoViviendaPct: 0,
      selladoComercialPct: 1,
      selladoComercialMipymePct: 0.5,
      selladoInquilinoPct: 100,
    });
  });

  it('regla 133: los días para pagar la diferencia de la liquidación final, de 0 a 60', async () => {
    guardarConfiguracionAlquileres.mockImplementation(async (_t, c) => c);
    render(<ConfiguracionForm inicial={INICIAL} />);
    const dias = screen.getByLabelText(/Días para pagar la diferencia/);
    expect(dias).toHaveValue('5');
    await userEvent.clear(dias);
    await userEvent.type(dias, '10');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(guardarConfiguracionAlquileres.mock.calls[0]![1].diasDiferenciaFinal).toBe(10);
    await userEvent.clear(dias);
    await userEvent.type(dias, '90');
    await userEvent.tab();
    expect(dias).toHaveValue('60');
  });
});
