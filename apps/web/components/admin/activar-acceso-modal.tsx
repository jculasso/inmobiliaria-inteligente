'use client';

import { useState, type FormEvent } from 'react';
import type { UsuarioAdminDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { activarAccesoUsuario } from '../../lib/admin-api';
import { Modal } from '../tablero/modal';

interface Props {
  tenantId: string;
  usuario: UsuarioAdminDto;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Crea la cuenta de Supabase Auth para un usuario que hoy solo existe como
 * registro de datos (vendedor cargado desde el Tablero, sin login). Sus
 * operaciones/tasaciones ya atribuidas quedan intactas — se vincula por
 * `authUserId`, sin tocar el id de negocio.
 */
export function ActivarAccesoModal({ tenantId, usuario, onClose, onSaved }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      await activarAccesoUsuario(accessToken, tenantId, usuario.id, { password });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el acceso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Activar acceso de ${usuario.nombre}`} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <p className="text-sm text-muted">
          Se va a crear una cuenta de acceso para <span className="font-medium text-ink">{usuario.email}</span>.
          Cuando entre, va a ver sus operaciones y tasaciones ya cargadas.
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Contraseña (mínimo 8 caracteres)</span>
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
            {loading ? 'Activando…' : 'Activar acceso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
