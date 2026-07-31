'use client';

import { useState, type FormEvent } from 'react';
import type { Rol, UsuarioAdminDto } from '@vacker/types';
import { Button, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createUsuarioAdmin, updateUsuarioAdmin } from '../../lib/admin-api';
import { Campo, CheckCard, Seccion, inputClass } from '../form-ui';

/** Qué ve/puede cada rol — evita tener que recordarlo de memoria al dar de alta. */
const ROLES_DISPONIBLES: { value: Rol; label: string; descripcion: string }[] = [
  { value: 'vendedor', label: 'Vendedor', descripcion: 'Ve lo suyo. No carga operaciones.' },
  { value: 'team_leader', label: 'Team Leader', descripcion: 'Ve lo suyo y lo de su equipo.' },
  { value: 'direccion', label: 'Dirección (CEO)', descripcion: 'Ve toda la inmobiliaria.' },
  {
    value: 'publicador',
    label: 'Publicador',
    descripcion: 'Publica propiedades en Tokko. Se suma a lo que la persona ya sea.',
  },
  { value: 'admin_tenant', label: 'Admin del tenant', descripcion: 'Administra usuarios y ajustes.' },
];

/**
 * Contraseña temporal sugerida. Sin ambiguos (0/O, 1/l/I) porque se dicta o se
 * copia a mano, y de todos modos dura hasta el primer ingreso.
 */
function passwordAlAzar(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (n) => abc[n % abc.length]).join('');
}

interface Props {
  tenantId: string;
  usuario?: UsuarioAdminDto;
  onClose: () => void;
  onSaved: () => void;
}

export function UsuarioAdminFormModal({ tenantId, usuario, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [password, setPassword] = useState(() => passwordAlAzar());
  const [estado, setEstado] = useState(usuario?.estado ?? 'activo');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [recibeReporte, setRecibeReporte] = useState(usuario?.recibeReporteSemanal ?? false);
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
      const tel = telefono.trim() || null;
      if (usuario) {
        await updateUsuarioAdmin(accessToken, tenantId, usuario.id, {
          nombre,
          email,
          estado,
          roles,
          telefono: tel,
          recibeReporteSemanal: recibeReporte,
        });
      } else {
        await createUsuarioAdmin(accessToken, tenantId, { nombre, email, password, roles, telefono: tel });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={usuario ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose} size="xl">
      <form className="grid gap-2.5 sm:grid-cols-2" onSubmit={handleSubmit}>
        <Seccion titulo="Datos personales" icono="👤">
          <div className="flex flex-col gap-2.5">
            <Campo label="Nombre y apellido">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputClass} />
            </Campo>
            <Campo label="Teléfono" hint="Aparece en el informe de tasación.">
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. 3415023921"
                className={inputClass}
              />
            </Campo>
            {usuario && (
              // Solo al editar: al crear no se sabe todavía si la persona va a
              // ser destinataria, y prender un envío por default es la forma
              // más rápida de que lo marquen como spam.
              <Campo
                label="Reporte semanal"
                hint="Recibe por mail el reporte del Protocolo, los lunes."
              >
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={recibeReporte}
                    onChange={(e) => setRecibeReporte(e.target.checked)}
                    className="h-4 w-4 accent-brand-red"
                  />
                  Recibe el reporte semanal
                </label>
              </Campo>
            )}
            {usuario && (
              <Campo label="Estado" hint="Un usuario inactivo no puede entrar.">
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
          </div>
        </Seccion>

        <Seccion titulo="Acceso" icono="🔒">
          <div className="flex flex-col gap-2.5">
            <Campo
              label="Email"
              hint={
                usuario
                  ? 'Es el email con el que inicia sesión: si lo cambiás, tiene que entrar con el nuevo.'
                  : 'Con este email inicia sesión.'
              }
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Campo>
            {!usuario && (
              <Campo
                label="Contraseña temporal"
                hint="Se la pasás para el primer ingreso; al entrar, el sistema le pide elegir una propia."
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(passwordAlAzar())}
                    title="Generar otra"
                    className="h-9 shrink-0 rounded-brand border border-line px-2.5 text-sm hover:bg-surface"
                  >
                    🎲
                  </button>
                </div>
              </Campo>
            )}
          </div>
        </Seccion>

        <Seccion titulo="Roles" icono="🎭" full>
          <p className="mb-2 text-xs leading-snug text-muted">
            Definen qué información ve. Se puede combinar más de uno.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ROLES_DISPONIBLES.map((r) => (
              <CheckCard
                key={r.value}
                checked={roles.includes(r.value)}
                onChange={() => toggleRol(r.value)}
                titulo={r.label}
                descripcion={r.descripcion}
              />
            ))}
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
