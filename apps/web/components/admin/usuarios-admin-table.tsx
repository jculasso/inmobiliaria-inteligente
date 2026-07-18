'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UsuarioAdminDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { UsuarioAdminFormModal } from './usuario-admin-form-modal';
import { ResetPasswordModal } from './reset-password-modal';
import { ActivarAccesoModal } from './activar-acceso-modal';

const ETIQUETA_ROL: Record<string, string> = {
  vendedor: 'Vendedor',
  team_leader: 'Team Leader',
  direccion: 'Dirección',
  admin_tenant: 'Admin tenant',
  admin_plataforma: 'Admin plataforma',
};

export function UsuariosAdminTable({
  tenantId,
  usuarios,
}: {
  tenantId: string;
  usuarios: UsuarioAdminDto[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<'create' | UsuarioAdminDto | null>(null);
  const [resetModal, setResetModal] = useState<UsuarioAdminDto | null>(null);
  const [activarModal, setActivarModal] = useState<UsuarioAdminDto | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Usuarios</h2>
        <Button variant="primary" size="sm" onClick={() => setModal('create')}>
          ＋ Nuevo usuario
        </Button>
      </div>

      <div className="overflow-x-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Roles</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acceso</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Todavía no hay usuarios en esta inmobiliaria.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium text-ink">{u.nombre}</td>
                  <td className="px-4 py-2 text-muted">{u.email}</td>
                  <td className="px-4 py-2 text-muted">
                    {u.roles.map((r) => ETIQUETA_ROL[r] ?? r).join(', ')}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.estado === 'activo' ? 'bg-success/10 text-success' : 'bg-surface text-muted'
                      }`}
                    >
                      {u.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {!u.tieneAcceso && (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                        Sin acceso
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setModal(u)}
                      aria-label="Editar"
                      className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                    >
                      ✏️
                    </button>
                    {u.tieneAcceso ? (
                      <button
                        type="button"
                        onClick={() => setResetModal(u)}
                        className="text-sm font-medium text-brand-red hover:underline"
                      >
                        Restablecer contraseña
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActivarModal(u)}
                        className="text-sm font-medium text-brand-red hover:underline"
                      >
                        Activar acceso
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <UsuarioAdminFormModal
          tenantId={tenantId}
          usuario={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {resetModal && (
        <ResetPasswordModal
          tenantId={tenantId}
          usuario={resetModal}
          onClose={() => setResetModal(null)}
          onSaved={() => setResetModal(null)}
        />
      )}

      {activarModal && (
        <ActivarAccesoModal
          tenantId={tenantId}
          usuario={activarModal}
          onClose={() => setActivarModal(null)}
          onSaved={() => {
            setActivarModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
