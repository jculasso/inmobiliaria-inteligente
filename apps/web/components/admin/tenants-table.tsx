'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { modulosHabilitados, type TenantDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { NOMBRE_MODULO } from '../../lib/modulos';
import { ListaTarjetas, Tarjeta } from '../tabla-movil';
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

      <div className="rounded-brand border border-line bg-white sm:hidden">
        {tenants.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">Todavía no hay inmobiliarias cargadas.</p>
        ) : (
          <ListaTarjetas etiqueta="Inmobiliarias">
            {tenants.map((t) => (
              <Tarjeta key={t.id}>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{t.nombre}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {t.slug} · plan {t.plan}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      t.estado === 'activo' ? 'bg-success/10 text-success' : 'bg-surface text-muted'
                    }`}
                  >
                    {t.estado === 'activo' ? 'Activo' : 'Suspendido'}
                  </span>
                </div>

                <div className="mt-2">
                  <span className="block text-[10px] uppercase tracking-wide text-muted">Módulos</span>
                  <span className="block text-sm text-ink">
                    {modulosHabilitados(t.modulos).map((m) => NOMBRE_MODULO[m]).join(', ') || '—'}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-end gap-3 border-t border-line pt-2">
                  <Link href={`/admin/tenants/${t.id}`} className="text-xs font-semibold text-brand-red hover:underline">
                    Ver usuarios →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setModal(t)}
                    className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
                  >
                    ✏️ Editar
                  </button>
                </div>
              </Tarjeta>
            ))}
          </ListaTarjetas>
        )}
      </div>

      <div className="hidden overflow-x-auto overscroll-x-contain rounded-brand border border-line bg-white sm:block">
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
                    {modulosHabilitados(t.modulos).map((m) => NOMBRE_MODULO[m]).join(', ') || '—'}
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
