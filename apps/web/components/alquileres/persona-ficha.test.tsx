import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PersonaFichaDto } from '@vacker/types';

const guardarCuentasBancarias = vi.fn();
const getFichaPersona = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/alquileres-api', () => ({
  guardarCuentasBancarias: (...a: unknown[]) => guardarCuentasBancarias(...a),
  getFichaPersona: (...a: unknown[]) => getFichaPersona(...a),
}));

import { CuentasBancarias } from './cuentas-bancarias';
import { EnviarMailModal } from './enviar-mail-modal';

const PERSONA = '11111111-1111-4111-8111-111111111111';

describe('Ficha de la persona (punto 14)', () => {
  it('un CBU mal copiado no se guarda: lo dice antes de ir a la API', async () => {
    render(<CuentasBancarias personaId={PERSONA} cuentas={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Agregar cuentas' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Agregar cuenta' }));
    fireEvent.change(screen.getByLabelText(/^Banco/), { target: { value: 'Nación' } });
    fireEvent.change(screen.getByLabelText(/^CBU/), { target: { value: '0110599520000001234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cuenta 1: El CBU no es válido');
    expect(guardarCuentasBancarias).not.toHaveBeenCalled();
  });

  it('con alias válido se guarda, y la primera queda principal', async () => {
    guardarCuentasBancarias.mockResolvedValueOnce([]);
    render(<CuentasBancarias personaId={PERSONA} cuentas={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Agregar cuentas' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Agregar cuenta' }));
    fireEvent.change(screen.getByLabelText(/^Banco/), { target: { value: 'Nación' } });
    fireEvent.change(screen.getByLabelText(/^Alias/), { target: { value: 'casa.mar.sol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardarCuentasBancarias).toHaveBeenCalled());
    expect(guardarCuentasBancarias.mock.calls[0]![2]).toEqual([expect.objectContaining({ banco: 'Nación', alias: 'casa.mar.sol', principal: true })]);
  });

  it('mandar por mail propone el mail de la persona y de sus contactos', async () => {
    getFichaPersona.mockResolvedValueOnce({
      persona: { id: PERSONA, nombre: 'Juan Propietario', email: 'juan@mail.com' },
      cuentas: [],
      contactos: [{ id: 'k', nombre: 'Sofía', relacion: 'Contadora', email: 'sofia@estudio.com', telefono: null, principal: true }],
      contratos: [],
    } as unknown as PersonaFichaDto);
    const enviar = vi.fn().mockResolvedValue({ enviado: true });
    render(<EnviarMailModal titulo="Enviar la liquidación 000007 por mail" personaId={PERSONA} enviar={enviar} onClose={vi.fn()} />);
    const dialogo = within(await screen.findByRole('dialog'));
    expect(await dialogo.findByLabelText(/juan@mail.com/)).toBeChecked();
    fireEvent.click(dialogo.getByLabelText(/sofia@estudio.com/));
    fireEvent.click(dialogo.getByRole('button', { name: '✉️ Enviar' }));
    await waitFor(() => expect(enviar).toHaveBeenCalledWith(['juan@mail.com', 'sofia@estudio.com']));
    expect(await dialogo.findByRole('status')).toHaveTextContent('Enviado a juan@mail.com, sofia@estudio.com');
  });
});
