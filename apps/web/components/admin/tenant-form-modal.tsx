'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { MODULOS_POR_PLAN, type PlanTenant, type TenantDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTenant, subirLogoTenant, updateTenant } from '../../lib/admin-api';
import { AvatarUploader } from '../avatar-uploader';
import { Modal } from '../tablero/modal';
import { NOMBRE_MODULO } from '../../lib/modulos';

interface Props {
  tenant?: TenantDto;
  onClose: () => void;
  onSaved: () => void;
}

export function TenantFormModal({ tenant, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(tenant?.nombre ?? '');
  const [slug, setSlug] = useState(tenant?.slug ?? '');
  const [plan, setPlan] = useState<PlanTenant>(tenant?.plan ?? 'basico');
  const [estado, setEstado] = useState(tenant?.estado ?? 'activo');
  const [logoUrl, setLogoUrl] = useState(tenant?.config.logoUrl ?? '');
  const [colorPrimario, setColorPrimario] = useState(tenant?.config.colorPrimario ?? '');
  const [colorPrimarioOscuro, setColorPrimarioOscuro] = useState(tenant?.config.colorPrimarioOscuro ?? '');
  const [nombreCorto, setNombreCorto] = useState(tenant?.config.nombreCorto ?? '');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const config = {
        logoUrl: logoUrl || null,
        colorPrimario: colorPrimario || null,
        colorPrimarioOscuro: colorPrimarioOscuro || null,
        nombreCorto: nombreCorto || null,
      };
      if (tenant) {
        await updateTenant(accessToken, tenant.id, { nombre, slug, plan, estado, config });
      } else {
        await createTenant(accessToken, { nombre, slug, plan, config });
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
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
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
        <p className="text-xs text-muted">
          Módulos incluidos: {MODULOS_POR_PLAN[plan].map((m) => NOMBRE_MODULO[m]).join(', ')}
        </p>

        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
          Branding (imagen de marca de la inmobiliaria)
        </p>
        <Campo label="URL del logo">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              className={`${inputClass} min-w-0`}
            />
            {tenant && (
              <AvatarUploader
                nombre={nombre || tenant.nombre}
                fotoUrl={logoUrl || null}
                size="md"
                onUpload={async (file) => {
                  const accessToken = await getAccessToken();
                  const actualizado = await subirLogoTenant(accessToken, tenant.id, file);
                  setLogoUrl(actualizado.config.logoUrl ?? '');
                }}
              />
            )}
          </div>
        </Campo>
        <Campo label="Nombre corto (para el título de la Home)">
          <input
            value={nombreCorto}
            onChange={(e) => setNombreCorto(e.target.value)}
            placeholder={nombre || 'Ej. Vacker'}
            className={inputClass}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Color primario">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorPrimario || '#c1121f'}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="h-9 w-9 shrink-0 rounded-brand border border-line"
              />
              <input
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                placeholder="#c1121f"
                className={inputClass}
              />
            </div>
          </Campo>
          <Campo label="Color primario oscuro">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorPrimarioOscuro || '#8f0d18'}
                onChange={(e) => setColorPrimarioOscuro(e.target.value)}
                className="h-9 w-9 shrink-0 rounded-brand border border-line"
              />
              <input
                value={colorPrimarioOscuro}
                onChange={(e) => setColorPrimarioOscuro(e.target.value)}
                placeholder="#8f0d18"
                className={inputClass}
              />
            </div>
          </Campo>
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
