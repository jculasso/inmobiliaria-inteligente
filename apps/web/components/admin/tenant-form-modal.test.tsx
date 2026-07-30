import { MODULO_KEYS } from '@vacker/types';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TenantDto } from '@vacker/types';
import { TenantFormModal } from './tenant-form-modal';

vi.mock('../avatar-uploader', () => ({ AvatarUploader: () => <div>avatar-uploader</div> }));

const TENANT: TenantDto = {
  id: '11111111-1111-1111-1111-111111111111',
  nombre: 'Vacker',
  slug: 'vacker',
  plan: 'enterprise',
  modulos: { tablero: true, tasador: true, todo: false, protocolo: false, publicacion: false },
  estado: 'activo',
  config: {},
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

    expect(screen.getByText(`Módulos habilitados · 2 de ${MODULO_KEYS.length}`)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Protocolo 5 Semanas/ }));
    expect(screen.getByText(`Módulos habilitados · 3 de ${MODULO_KEYS.length}`)).toBeInTheDocument();
  });

  it('aclara que el plan es solo una etiqueta comercial', () => {
    render(<TenantFormModal tenant={TENANT} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/Solo etiqueta comercial/)).toBeInTheDocument();
  });
});
