'use client';

import { useState, type FormEvent } from 'react';
import type { VendedorDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createVendedor, updateVendedor } from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';
import { Campo, MoneyInput, OpcionCard, Seccion, inputClass } from '../form-ui';

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
  const objetivoMensual = (Number(objComision) || 0) / 12;

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
    <Modal title={vendedor ? 'Editar vendedor' : 'Nuevo vendedor'} onClose={onClose} size="xl">
      <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <Seccion titulo="Datos personales" icono="👤">
          <div className="flex flex-col gap-2.5">
            <Campo label="Nombre y apellido">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputClass} />
            </Campo>
            <Campo
              label="Email"
              hint="Es el usuario con el que inicia sesión: si lo cambiás, tiene que entrar con el nuevo."
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Campo>
            <Campo label="Estado" hint="Un vendedor inactivo deja de aparecer en los listados.">
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as 'activo' | 'inactivo')}
                className={inputClass}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Rol y equipo" icono="🎭">
          <div className="flex flex-col gap-2.5">
            <div>
              <span className="mb-1 block text-sm font-medium text-ink">Rol</span>
              <div className="grid grid-cols-2 gap-1.5">
                <OpcionCard
                  seleccionada={rol === 'vendedor'}
                  onSelect={() => setRol('vendedor')}
                  titulo="Vendedor"
                  descripcion="Ve y carga lo suyo."
                />
                <OpcionCard
                  seleccionada={rol === 'team_leader'}
                  onSelect={() => setRol('team_leader')}
                  titulo="Team Leader"
                  descripcion="Ve lo de su equipo."
                />
              </div>
            </div>

            <Campo
              label="Reporta a"
              hint={
                lideresDisponibles.length === 0
                  ? 'Todavía no hay team leaders cargados.'
                  : 'Define de quién es el equipo para el alcance por rol.'
              }
            >
              <select
                value={liderId}
                onChange={(e) => setLiderId(e.target.value)}
                disabled={lideresDisponibles.length === 0}
                className={inputClass}
              >
                <option value="">Sin líder asignado</option>
                {lideresDisponibles.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo={`Objetivo ${anioActual}`} icono="🎯" full>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Campo label="Comisión objetivo del año">
              <MoneyInput value={objComision} onChange={setObjComision} />
            </Campo>
            <div className="flex flex-col justify-center rounded-brand bg-surface px-3 py-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted">
                Equivale por mes
              </span>
              <span className="text-lg font-extrabold text-ink">
                {objetivoMensual > 0 ? fmtUSD(objetivoMensual) : '—'}
              </span>
            </div>
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
