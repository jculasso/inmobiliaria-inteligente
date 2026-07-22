'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { Rol, UsuarioAdminDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createUsuarioAdmin, updateUsuarioAdmin } from '../../lib/admin-api';

const ROLES_DISPONIBLES: { value: Rol; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'direccion', label: 'Dirección (CEO)' },
  { value: 'admin_tenant', label: 'Admin del tenant' },
];

interface Props {
  tenantId: string;
  usuario?: UsuarioAdminDto;
  onClose: () => void;
  onSaved: () => void;
}

export function UsuarioAdminFormModal({ tenantId, usuario, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState(usuario?.estado ?? 'activo');
  const [roles, setRoles] = useState<Rol[]>(usuario?.roles ?? ['vendedor']);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRol(rol: Rol) {
    setRoles((prev) => (prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (roles.length === 0) {
      setError('Elegí al menos un rol.');
      return;
    }
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (usuario) {
        await updateUsuarioAdmin(accessToken, tenantId, usuario.id, { nombre, estado, roles });
      } else {
        await createUsuarioAdmin(accessToken, tenantId, { nombre, email, password, roles });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={usuario ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <Campo label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputClass} />
        </Campo>
        <Campo label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!!usuario}
            className={inputClass}
          />
        </Campo>
        {!usuario && (
          <Campo label="Contraseña inicial (mínimo 8 caracteres)">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={inputClass}
            />
          </Campo>
        )}
        {usuario && (
          <Campo label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as 'activo' | 'inactivo')}
              className={inputClass}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Campo>
        )}
        <div>
          <span className="text-sm font-medium text-ink">Roles</span>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {ROLES_DISPONIBLES.map((r) => (
              <label key={r.value} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" checked={roles.includes(r.value)} onChange={() => toggleRol(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>

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

const inputClass =
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red disabled:bg-surface disabled:text-muted';

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
