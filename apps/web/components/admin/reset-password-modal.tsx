'use client';

import { useState, type FormEvent } from 'react';
import type { UsuarioAdminDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { resetPasswordUsuario } from '../../lib/admin-api';
import { Modal } from '../tablero/modal';

interface Props {
  tenantId: string;
  usuario: UsuarioAdminDto;
  onClose: () => void;
  onSaved: () => void;
}

export function ResetPasswordModal({ tenantId, usuario, onClose, onSaved }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      await resetPasswordUsuario(accessToken, tenantId, usuario.id, { password });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Restablecer contraseña de ${usuario.nombre}`} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Nueva contraseña (mínimo 8 caracteres)</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
