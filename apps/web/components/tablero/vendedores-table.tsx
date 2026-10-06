'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VendedorDto } from '@vacker/types';
import { Avatar } from '@vacker/ui';
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
import {
  AccionesFila,
  BarraLista,
  BotonNuevo,
  CLASE_FOCO,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TH,
} from '../piezas';
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

  /**
   * La insignia de estado, que para quien gestiona es además el botón que
   * activa o desactiva. Dice qué hace y a quién: «Activo» solo no dice que
   * tocarlo lo desactiva.
   */
  // Una función y no un componente: definido adentro, cada render sería un
  // componente nuevo y el botón perdería el foco al refrescar.
  function estadoVendedor(v: VendedorDto) {
    const activo = v.estado === 'activo';
    return (
      <button
        type="button"
        disabled={!puedeGestionar || loadingId === v.id}
        onClick={() => toggleEstado(v)}
        aria-label={
          puedeGestionar
            ? `${activo ? 'Activo' : 'Inactivo'}: ${activo ? 'desactivar' : 'activar'} a ${v.nombre}`
            : undefined
        }
        title={puedeGestionar ? (activo ? 'Desactivar' : 'Activar') : undefined}
        className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASE_FOCO} ${
          activo ? 'bg-success/10 text-success' : 'bg-ink/5 text-muted'
        } ${puedeGestionar ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {activo ? 'Activo' : 'Inactivo'}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre…"
        visibles={filtrados.length}
        total={vendedores.length}
        nombre="vendedores"
      >
        {puedeGestionar && (
          <BotonNuevo onClick={() => setModal('create')}>Nuevo vendedor</BotonNuevo>
        )}
      </BarraLista>

      <div className={CLASE_LISTA_MOVIL}>
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
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                      {v.nombre}
                    </span>
                    {estadoVendedor(v)}
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
                    <AccionesFila nombre={`a ${v.nombre}`} onEditar={() => setModal(v)} tarjeta />
                  )}
                </Tarjeta>
              );
            })}
          </ListaTarjetas>
        )}
      </div>

      <div className={CLASE_TABLA_ANCHA}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={CLASE_TH}>Vendedor</th>
              <th className={CLASE_TH}>Estado</th>
              <th className={CLASE_TH}>Rol / equipo</th>
              <th className={CLASE_TH}>Obj. comisión {anioActual}</th>
              {puedeGestionar && (
                <th className={CLASE_TH}>
                  <span className="sr-only">Acciones</span>
                </th>
              )}
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
                    <td className="px-4 py-2">{estadoVendedor(v)}</td>
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
                        <AccionesFila nombre={`a ${v.nombre}`} onEditar={() => setModal(v)} />
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
