import { MODULO_KEYS, configPorDefecto } from '@vacker/types';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TenantDto } from '@vacker/types';
import { TenantFormModal } from './tenant-form-modal';

vi.mock('../avatar-uploader', () => ({ AvatarUploader: () => <div>avatar-uploader</div> }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
const updateTenant = vi.fn().mockResolvedValue({});
vi.mock('../../lib/admin-api', () => ({
  updateTenant: (...a: unknown[]) => updateTenant(...a),
  createTenant: vi.fn(),
  subirLogoTenant: vi.fn(),
}));

const TENANT: TenantDto = {
  id: '11111111-1111-1111-1111-111111111111',
  nombre: 'Vacker',
  slug: 'vacker',
  plan: 'enterprise',
  modulos: {
    tablero: true,
    tasador: true,
    todo: false,
    protocolo: false,
    publicacion: false,
    alquileres: false,
  },
  estado: 'activo',
  config: configPorDefecto(),
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('TenantFormModal', () => {
  it('muestra un check por módulo, marcado según lo habilitado del tenant', () => {
    render(<TenantFormModal tenant={TENANT} onClose={() => {}} onSaved={() => {}} />);

    const tablero = screen.getByRole('checkbox', { name: /Tablero Comercial/ });
    const todo = screen.getByRole('checkbox', { name: /To Do List/ });
    const protocolo = screen.getByRole('checkbox', { name: /Protocolo 5 Semanas/ });

    expect(tablero).toBeChecked();
    expect(todo).not.toBeChecked();
    expect(protocolo).not.toBeChecked();
  });

  it('lleva la cuenta de módulos habilitados al prender uno', async () => {
    const user = userEvent.setup();
    render(<TenantFormModal tenant={TENANT} onClose={() => {}} onSaved={() => {}} />);

    expect(
      screen.getByText(`Módulos habilitados · 2 de ${MODULO_KEYS.length}`),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Protocolo 5 Semanas/ }));
    expect(
      screen.getByText(`Módulos habilitados · 3 de ${MODULO_KEYS.length}`),
    ).toBeInTheDocument();
  });

  it('aclara que el plan es solo una etiqueta comercial', () => {
    render(<TenantFormModal tenant={TENANT} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/Solo etiqueta comercial/)).toBeInTheDocument();
  });
});

/**
 * El criterio de tasación se carga en porcentaje. Era `type=number` con
 * `Number(texto) || 100`: un 0 escrito a propósito se guardaba como 100, y
 * «12,5» con coma caía al valor por defecto sin avisar.
 */
describe('TenantFormModal · criterio de tasación', () => {
  async function guardarCon(semi: string, desc: string) {
    updateTenant.mockClear();
    const user = userEvent.setup();
    render(<TenantFormModal tenant={TENANT} onClose={() => {}} onSaved={() => {}} />);
    const semicubierta = screen.getByRole('textbox', { name: /Semicubierta/ });
    const descubierta = screen.getByRole('textbox', { name: /Descubierta/ });
    await user.clear(semicubierta);
    if (semi) await user.type(semicubierta, semi);
    await user.clear(descubierta);
    if (desc) await user.type(descubierta, desc);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
  }

  it('acepta coma decimal y respeta el cero', async () => {
    await guardarCon('0', '12,5');
    expect(updateTenant).toHaveBeenCalledTimes(1);
    expect(updateTenant.mock.calls[0]![2].config).toMatchObject({
      coefSemicubierta: 0,
      coefDescubierta: 0.125,
    });
  });

  it('vacío es el criterio de siempre (100% y 30%)', async () => {
    await guardarCon('', '');
    expect(updateTenant.mock.calls[0]![2].config).toMatchObject({
      coefSemicubierta: 1,
      coefDescubierta: 0.3,
    });
  });

  it('fuera de 0 a 100 no guarda y lo dice en rojo de peligro', async () => {
    await guardarCon('150', '30');
    expect(updateTenant).not.toHaveBeenCalled();
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('van de 0 a 100');
    expect(alerta).toHaveClass('text-danger');
  });
});
