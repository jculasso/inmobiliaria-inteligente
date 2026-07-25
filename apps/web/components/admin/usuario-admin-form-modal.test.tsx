import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UsuarioAdminDto } from '@vacker/types';
import { UsuarioAdminFormModal } from './usuario-admin-form-modal';

const USUARIO: UsuarioAdminDto = {
  id: '22222222-2222-2222-2222-222222222222',
  nombre: 'Ezequiel',
  email: 'ezequiel@vacker.com',
  telefono: null,
  estado: 'activo',
  roles: ['vendedor'],
  tieneAcceso: true,
  fotoUrl: null,
};

describe('UsuarioAdminFormModal', () => {
  it('muestra los 4 roles con su explicación y marca los del usuario', () => {
    render(<UsuarioAdminFormModal tenantId="t" usuario={USUARIO} onClose={() => {}} onSaved={() => {}} />);

    expect(screen.getByRole('checkbox', { name: /Vendedor/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Team Leader/ })).not.toBeChecked();
    expect(screen.getByText('Ve lo suyo y lo de su equipo.')).toBeInTheDocument();
    expect(screen.getByText('Ve toda la inmobiliaria.')).toBeInTheDocument();
  });

  it('no deja guardar sin ningún rol', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<UsuarioAdminFormModal tenantId="t" usuario={USUARIO} onClose={() => {}} onSaved={onSaved} />);

    await user.click(screen.getByRole('checkbox', { name: /Vendedor/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Elegí al menos un rol.');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('en edición el email queda bloqueado y no pide contraseña', () => {
    render(<UsuarioAdminFormModal tenantId="t" usuario={USUARIO} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByDisplayValue('ezequiel@vacker.com')).toBeDisabled();
    expect(screen.queryByText(/Contraseña inicial/)).not.toBeInTheDocument();
  });

  it('en alta pide contraseña y el email es editable', () => {
    render(<UsuarioAdminFormModal tenantId="t" onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/Contraseña inicial/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Email/ })).toBeEnabled();
  });
});
