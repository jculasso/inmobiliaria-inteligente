'use client';

import { useState, type FormEvent } from 'react';
import {
  MODULOS_DEFAULT,
  MODULO_KEYS,
  type ModulosTenant,
  type PlanTenant,
  type TenantDto,
} from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTenant, subirLogoTenant, updateTenant } from '../../lib/admin-api';
import { AvatarUploader } from '../avatar-uploader';
import { NOMBRE_MODULO } from '../../lib/modulos';
import { Campo, CheckCard, Seccion, inputClass } from '../form-ui';

/** Qué hace cada módulo — se muestra bajo el check para no vender a ciegas. */
const DESCRIPCION_MODULO: Record<string, string> = {
  tablero: 'KPIs, ranking y objetivos.',
  tasador: 'Valuación e informes.',
  todo: 'Agenda con Google Calendar.',
  protocolo: 'Comercialización en 5 semanas.',
};

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
  const [modulos, setModulos] = useState<ModulosTenant>(tenant?.modulos ?? MODULOS_DEFAULT);
  const [logoUrl, setLogoUrl] = useState(tenant?.config.logoUrl ?? '');
  const [colorPrimario, setColorPrimario] = useState(tenant?.config.colorPrimario ?? '');
  const [colorPrimarioOscuro, setColorPrimarioOscuro] = useState(tenant?.config.colorPrimarioOscuro ?? '');
  const [nombreCorto, setNombreCorto] = useState(tenant?.config.nombreCorto ?? '');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cantidadModulos = MODULO_KEYS.filter((k) => modulos[k]).length;

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
        await updateTenant(accessToken, tenant.id, { nombre, slug, plan, modulos, estado, config });
      } else {
        await createTenant(accessToken, { nombre, slug, plan, modulos, config });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la inmobiliaria.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={tenant ? 'Editar inmobiliaria' : 'Nueva inmobiliaria'} onClose={onClose} size="xl">
      <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <Seccion titulo="Datos de la inmobiliaria" icono="🏢">
          <div className="flex flex-col gap-2.5">
            <Campo label="Nombre">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputClass} />
            </Campo>
            <Campo label="Slug" hint="Identificador único en minúsculas, ej. vacker.">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                required
                pattern="[a-z0-9-]+"
                title="Solo minúsculas, números y guiones"
                className={inputClass}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2.5">
              <Campo label="Plan" hint="Solo etiqueta comercial.">
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
          </div>
        </Seccion>

        <Seccion titulo={`Módulos habilitados · ${cantidadModulos} de ${MODULO_KEYS.length}`} icono="🔑">
          <p className="mb-2 text-xs leading-snug text-muted">
            Definen a qué accede la inmobiliaria. Lo que está apagado no se ve ni se puede usar.
          </p>
          <div className="grid gap-1.5">
            {MODULO_KEYS.map((key) => (
              <CheckCard
                key={key}
                checked={modulos[key]}
                onChange={(v) => setModulos((m) => ({ ...m, [key]: v }))}
                titulo={NOMBRE_MODULO[key]}
                descripcion={DESCRIPCION_MODULO[key]}
              />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Imagen de marca" icono="🎨" full>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo label="Logo">
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
            <Campo label="Nombre corto" hint="Se usa en el título de la Home.">
              <input
                value={nombreCorto}
                onChange={(e) => setNombreCorto(e.target.value)}
                placeholder={nombre || 'Ej. Vacker'}
                className={inputClass}
              />
            </Campo>
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
        </Seccion>

        {error && (
          <p role="alert" className="text-sm font-medium text-brand-red sm:col-span-2">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
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
