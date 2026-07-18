'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { PlanTenant, TenantDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTenant, updateTenant } from '../../lib/admin-api';
import { Modal } from '../tablero/modal';

interface Props {
  tenant?: TenantDto;
  onClose: () => void;
  onSaved: () => void;
}

export function TenantFormModal({ tenant, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(tenant?.nombre ?? '');
  const [slug, setSlug] = useState(tenant?.slug ?? '');
  const [plan, setPlan] = useState<PlanTenant>((tenant?.plan as PlanTenant) ?? 'basico');
  const [estado, setEstado] = useState(tenant?.estado ?? 'activo');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (tenant) {
        await updateTenant(accessToken, tenant.id, { nombre, plan, estado });
      } else {
        await createTenant(accessToken, { nombre, slug, plan });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la inmobiliaria.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={tenant ? 'Editar inmobiliaria' : 'Nueva inmobiliaria'} onClose={onClose}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <Campo label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputClass} />
        </Campo>
        <Campo label="Slug (identificador único, ej. vacker)">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            disabled={!!tenant}
            pattern="[a-z0-9-]+"
            title="Solo minúsculas, números y guiones"
            className={inputClass}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value as PlanTenant)} className={inputClass}>
              <option value="basico">Básico</option>
              <option value="profesional">Profesional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Campo>
          {tenant && (
            <Campo label="Estado">
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as 'activo' | 'suspendido')}
                className={inputClass}
              >
                <option value="activo">Activo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </Campo>
          )}
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
