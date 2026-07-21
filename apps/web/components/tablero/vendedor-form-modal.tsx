'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { VendedorDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createVendedor, updateVendedor } from '../../lib/tablero-api';
import { Modal } from './modal';

interface Props {
  vendedores: VendedorDto[];
  vendedor?: VendedorDto;
  onClose: () => void;
  onSaved: () => void;
}

export function VendedorFormModal({ vendedores, vendedor, onClose, onSaved }: Props) {
  const anioActual = new Date().getFullYear();
  const objetivoActual = vendedor?.objetivos.find((o) => o.anio === anioActual);

  const [nombre, setNombre] = useState(vendedor?.nombre ?? '');
  const [email, setEmail] = useState(vendedor?.email ?? '');
  const [estado, setEstado] = useState(vendedor?.estado ?? 'activo');
  const [rol, setRol] = useState<'vendedor' | 'team_leader'>(
    vendedor?.roles.includes('team_leader') ? 'team_leader' : 'vendedor',
  );
  const [liderId, setLiderId] = useState(vendedor?.liderId ?? '');
  const [objComision, setObjComision] = useState(String(objetivoActual?.objComision ?? ''));

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lideresDisponibles = vendedores.filter(
    (v) => v.roles.includes('team_leader') && v.id !== vendedor?.id,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      // Objetivo va inline en el mismo POST/PATCH (1 sola transacción en vez
      // de 2 requests separados) — con la latencia hacia la base, evitar un
      // segundo viaje completo solo para el objetivo se nota bastante.
      const objetivo = { anio: anioActual, objComision: Number(objComision) || 0, objVolumen: 0, objPuntas: 0 };

      if (vendedor) {
        // El selector "Rol" solo alterna vendedor/team_leader — se preservan
        // 'direccion'/'admin_tenant' si el usuario ya los tenía, para no
        // pisarle un rol elevado por una edición que no lo tocaba (ej. asignar líder).
        const rolesElevados = vendedor.roles.filter((r) => r === 'direccion' || r === 'admin_tenant');
        await updateVendedor(accessToken, vendedor.id, {
          nombre,
          email,
          estado,
          liderId: liderId || null,
          roles: [...new Set([rol, ...rolesElevados])],
          objetivo,
        });
      } else {
        await createVendedor(accessToken, {
          nombre,
          email,
          estado,
          liderId: liderId || null,
          roles: [rol],
          objetivo,
        });
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el vendedor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={vendedor ? 'Editar vendedor' : 'Nuevo vendedor'} onClose={onClose}>
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
            className={inputClass}
          />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Campo label="Rol">
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as 'vendedor' | 'team_leader')}
              className={inputClass}
            >
              <option value="vendedor">Vendedor</option>
              <option value="team_leader">Team Leader</option>
            </select>
          </Campo>
        </div>
        <Campo label="Reporta a">
          <select value={liderId} onChange={(e) => setLiderId(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {lideresDisponibles.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label={`Objetivo de comisión ${anioActual} (USD)`}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={objComision}
            onChange={(e) => setObjComision(e.target.value)}
            className={inputClass}
          />
        </Campo>

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
  'h-9 w-full rounded-brand border border-line px-2.5 text-sm text-ink outline-none focus:border-brand-red';

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
