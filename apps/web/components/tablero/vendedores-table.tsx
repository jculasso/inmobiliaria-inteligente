'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VendedorDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { desactivarVendedor, updateVendedor } from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';
import { VendedorFormModal } from './vendedor-form-modal';

export function VendedoresTable({
  vendedores,
  puedeGestionar,
}: {
  vendedores: VendedorDto[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const anioActual = new Date().getFullYear();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'create' | VendedorDto | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return vendedores;
    return vendedores.filter((v) => v.nombre.toLowerCase().includes(q));
  }, [vendedores, busqueda]);

  async function toggleEstado(v: VendedorDto) {
    setLoadingId(v.id);
    try {
      const accessToken = await getAccessToken();
      if (v.estado === 'activo') {
        await desactivarVendedor(accessToken, v.id);
      } else {
        await updateVendedor(accessToken, v.id, { estado: 'activo' });
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="h-9 w-full max-w-sm rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
        />
        {puedeGestionar && (
          <Button variant="primary" size="sm" onClick={() => setModal('create')}>
            ＋ Nuevo vendedor
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Vendedor</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Rol / equipo</th>
              <th className="px-4 py-2">Obj. comisión {anioActual}</th>
              {puedeGestionar && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={puedeGestionar ? 5 : 4} className="px-4 py-6 text-center text-muted">
                  Sin vendedores para mostrar.
                </td>
              </tr>
            ) : (
              filtrados.map((v) => {
                const objetivo = v.objetivos.find((o) => o.anio === anioActual);
                return (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-medium text-ink">{v.nombre}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        disabled={!puedeGestionar || loadingId === v.id}
                        onClick={() => toggleEstado(v)}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          v.estado === 'activo' ? 'bg-success/10 text-success' : 'bg-surface text-muted'
                        } ${puedeGestionar ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {v.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {v.roles.includes('team_leader')
                        ? '👔 Líder'
                        : v.lider
                          ? `→ ${v.lider.nombre}`
                          : 'Vendedor'}
                    </td>
                    <td className="px-4 py-2">{fmtUSD(objetivo?.objComision ?? 0)}</td>
                    {puedeGestionar && (
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setModal(v)}
                          aria-label="Editar"
                          className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                        >
                          ✏️
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <VendedorFormModal
          vendedores={vendedores}
          vendedor={modal === 'create' ? undefined : modal}
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
