'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VendedorDto } from '@vacker/types';
import { Avatar, Button } from '@vacker/ui';
import { AvatarUploader } from '../avatar-uploader';
import { getAccessToken } from '../../lib/supabase/client';
import {
  desactivarVendedor,
  eliminarFotoVendedor,
  subirFotoVendedor,
  updateVendedor,
} from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
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

  /**
   * Cambiar la foto NO es un permiso aparte: quien gestiona vendedores puede
   * cambiarla. Es el pedido concreto — que cuando la dirección incorpora a
   * alguien no tenga que esperar a que la subamos nosotros.
   */
  async function cambiarFoto(id: string, file: File) {
    const accessToken = await getAccessToken();
    await subirFotoVendedor(accessToken, id, file);
    router.refresh();
  }

  async function quitarFoto(id: string) {
    const accessToken = await getAccessToken();
    await eliminarFotoVendedor(accessToken, id);
    router.refresh();
  }

  /** El avatar es editable solo para quien gestiona; si no, es una imagen. */
  function AvatarDe({ v }: { v: VendedorDto }) {
    if (!puedeGestionar) return <Avatar nombre={v.nombre} fotoUrl={v.fotoUrl} size="sm" />;
    return (
      <AvatarUploader
        nombre={v.nombre}
        fotoUrl={v.fotoUrl}
        onUpload={(file) => cambiarFoto(v.id, file)}
        onRemove={() => quitarFoto(v.id)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="rounded-brand border border-line bg-white sm:hidden">
        {filtrados.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">Sin vendedores para mostrar.</p>
        ) : (
          <ListaTarjetas etiqueta="Vendedores">
            {filtrados.map((v) => {
              const objetivo = v.objetivos.find((o) => o.anio === anioActual);
              return (
                <Tarjeta key={v.id}>
                  <div className="flex items-center gap-2">
                    <AvatarDe v={v} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{v.nombre}</span>
                    <button
                      type="button"
                      disabled={!puedeGestionar || loadingId === v.id}
                      onClick={() => toggleEstado(v)}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        v.estado === 'activo' ? 'bg-success/10 text-success' : 'bg-surface text-muted'
                      }`}
                    >
                      {v.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <CamposTarjeta>
                    <CampoTarjeta etiqueta="Rol / equipo">
                      {v.roles.includes('team_leader')
                        ? '👔 Líder'
                        : v.lider
                          ? `→ ${v.lider.nombre}`
                          : 'Vendedor'}
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta={`Obj. comisión ${anioActual}`}>
                      {fmtUSD(objetivo?.objComision ?? 0)}
                    </CampoTarjeta>
                  </CamposTarjeta>

                  {puedeGestionar && (
                    <div className="mt-2 flex justify-end border-t border-line pt-2">
                      <button
                        type="button"
                        onClick={() => setModal(v)}
                        className="rounded px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  )}
                </Tarjeta>
              );
            })}
          </ListaTarjetas>
        )}
      </div>

      <div className="hidden overflow-x-auto overscroll-x-contain rounded-brand border border-line bg-white sm:block">
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
                    <td className="px-4 py-2 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <AvatarDe v={v} />
                        {v.nombre}
                      </div>
                    </td>
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
