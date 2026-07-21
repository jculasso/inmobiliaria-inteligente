'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MODULOS_POR_PLAN, type TenantDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { NOMBRE_MODULO } from '../../lib/modulos';
import { TenantFormModal } from './tenant-form-modal';

export function TenantsTable({ tenants }: { tenants: TenantDto[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<'create' | TenantDto | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Inmobiliarias</h2>
        <Button variant="primary" size="sm" onClick={() => setModal('create')}>
          ＋ Nueva inmobiliaria
        </Button>
      </div>

      <div className="overflow-x-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Módulos</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Todavía no hay inmobiliarias cargadas.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium text-ink">{t.nombre}</td>
                  <td className="px-4 py-2 text-muted">{t.slug}</td>
                  <td className="px-4 py-2 capitalize text-muted">{t.plan}</td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {MODULOS_POR_PLAN[t.plan].map((m) => NOMBRE_MODULO[m]).join(', ')}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.estado === 'activo' ? 'bg-success/10 text-success' : 'bg-surface text-muted'
                      }`}
                    >
                      {t.estado === 'activo' ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex items-center gap-3">
                    <Link href={`/admin/tenants/${t.id}`} className="text-sm font-medium text-brand-red hover:underline">
                      Ver usuarios →
                    </Link>
                    <button
                      type="button"
                      onClick={() => setModal(t)}
                      aria-label="Editar"
                      className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <TenantFormModal
          tenant={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
