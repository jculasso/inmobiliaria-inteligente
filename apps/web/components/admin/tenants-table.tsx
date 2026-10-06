'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { modulosHabilitados, type TenantDto } from '@vacker/types';
import { NOMBRE_MODULO } from '../../lib/modulos';
import { CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import {
  AccionesFila,
  BotonNuevo,
  CLASE_FOCO,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TH,
  CabezaTarjeta,
  EncabezadoPagina,
  Insignia,
} from '../piezas';
import { TenantFormModal } from './tenant-form-modal';

const modulosDe = (t: TenantDto) =>
  modulosHabilitados(t.modulos)
    .map((m) => NOMBRE_MODULO[m])
    .join(', ') || '—';

/** «Activo» verde; «Suspendido» gris: no es urgente, es algo que ya no cuenta. */
function EstadoTenant({ t }: { t: TenantDto }) {
  return t.estado === 'activo' ? (
    <Insignia tono="exito">Activo</Insignia>
  ) : (
    <Insignia tono="neutro">Suspendido</Insignia>
  );
}

/** El camino a los usuarios de una inmobiliaria: un link, porque navega. */
function VerUsuarios({ t, tarjeta = false }: { t: TenantDto; tarjeta?: boolean }) {
  return (
    <Link
      href={`/admin/tenants/${t.id}`}
      aria-label={`Ver los usuarios de ${t.nombre}`}
      className={`rounded px-2 py-1 font-semibold text-brand-red hover:underline ${tarjeta ? 'text-xs' : 'text-sm'} ${CLASE_FOCO}`}
    >
      Ver usuarios →
    </Link>
  );
}

export function TenantsTable({ tenants }: { tenants: TenantDto[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<'create' | TenantDto | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <EncabezadoPagina titulo="Inmobiliarias">
        <BotonNuevo onClick={() => setModal('create')}>Nueva inmobiliaria</BotonNuevo>
      </EncabezadoPagina>

      <div className={CLASE_LISTA_MOVIL}>
        {tenants.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">Todavía no hay inmobiliarias cargadas.</p>
        ) : (
          <ListaTarjetas etiqueta="Inmobiliarias">
            {tenants.map((t) => (
              <Tarjeta key={t.id}>
                <CabezaTarjeta
                  titulo={t.nombre}
                  detalle={`${t.slug} · plan ${t.plan}`}
                  insignia={<EstadoTenant t={t} />}
                />
                <div className="mt-2">
                  <CampoTarjeta etiqueta="Módulos">{modulosDe(t)}</CampoTarjeta>
                </div>
                <AccionesFila
                  nombre={`la inmobiliaria ${t.nombre}`}
                  onEditar={() => setModal(t)}
                  extra={<VerUsuarios t={t} tarjeta />}
                  tarjeta
                />
              </Tarjeta>
            ))}
          </ListaTarjetas>
        )}
      </div>

      <div className={CLASE_TABLA_ANCHA}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={CLASE_TH}>Nombre</th>
              <th className={CLASE_TH}>Slug</th>
              <th className={CLASE_TH}>Plan</th>
              <th className={CLASE_TH}>Módulos</th>
              <th className={CLASE_TH}>Estado</th>
              <th className={CLASE_TH}>
                <span className="sr-only">Acciones</span>
              </th>
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
                  <td className="px-3 py-2 font-medium text-ink">{t.nombre}</td>
                  <td className="px-3 py-2 text-muted">{t.slug}</td>
                  <td className="px-3 py-2 capitalize text-muted">{t.plan}</td>
                  <td className="px-3 py-2 text-xs text-muted">{modulosDe(t)}</td>
                  <td className="px-3 py-2">
                    <EstadoTenant t={t} />
                  </td>
                  {/* El `flex` va en un div: en la celda misma, la saca de la tabla y se desalinea. */}
                  <td className="px-3 py-2">
                    <AccionesFila
                      nombre={`la inmobiliaria ${t.nombre}`}
                      onEditar={() => setModal(t)}
                      extra={<VerUsuarios t={t} />}
                    />
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
