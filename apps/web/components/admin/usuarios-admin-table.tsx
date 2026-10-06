'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UsuarioAdminDto } from '@vacker/types';
import { Avatar } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { eliminarFotoUsuario, subirFotoUsuario } from '../../lib/admin-api';
import { ETIQUETA_ROL } from '../../lib/rbac';
import { AvatarUploader } from '../avatar-uploader';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import {
  AccionesFila,
  BotonNuevo,
  CLASE_FOCO,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TH,
  CabezaTarjeta,
  Insignia,
  TituloSeccion,
} from '../piezas';
import { UsuarioAdminFormModal } from './usuario-admin-form-modal';
import { ResetPasswordModal } from './reset-password-modal';
import { ActivarAccesoModal } from './activar-acceso-modal';

// Las etiquetas de rol salen de `lib/rbac` (había una copia acá sin
// «Publicador» ni «Administración»: esos roles se veían con el enum crudo).
const rolesDe = (u: UsuarioAdminDto) =>
  u.roles.map((r) => ETIQUETA_ROL[r as keyof typeof ETIQUETA_ROL] ?? r).join(', ');

const EstadoUsuario = ({ u }: { u: UsuarioAdminDto }) =>
  u.estado === 'activo' ? (
    <Insignia tono="exito">Activo</Insignia>
  ) : (
    <Insignia tono="neutro">Inactivo</Insignia>
  );

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

  /** Restablecer la clave o dar el acceso: lo propio de cada fila, con el nombre para el lector de pantalla. */
  const accesoDe = (u: UsuarioAdminDto, tarjeta = false) => (
    <button
      type="button"
      onClick={() => (u.tieneAcceso ? setResetModal(u) : setActivarModal(u))}
      aria-label={
        u.tieneAcceso
          ? `Restablecer la contraseña de ${u.nombre}`
          : `Activar el acceso de ${u.nombre}`
      }
      className={`whitespace-nowrap rounded px-2 py-1 font-semibold text-brand-red hover:underline ${tarjeta ? 'text-xs' : 'text-sm'} ${CLASE_FOCO}`}
    >
      {u.tieneAcceso ? 'Restablecer contraseña' : 'Activar acceso'}
    </button>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloSeccion icono="👥" detalle={`${usuarios.length}`}>
          Usuarios
        </TituloSeccion>
        <BotonNuevo onClick={() => setModal('create')}>Nuevo usuario</BotonNuevo>
      </div>

      <div className={CLASE_LISTA_MOVIL}>
        {usuarios.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">
            Todavía no hay usuarios en esta inmobiliaria.
          </p>
        ) : (
          <ListaTarjetas etiqueta="Usuarios">
            {usuarios.map((u) => (
              <Tarjeta key={u.id}>
                <CabezaTarjeta
                  titulo={
                    <span className="flex items-center gap-2">
                      <Avatar nombre={u.nombre} fotoUrl={u.fotoUrl} size="sm" />
                      <span className="min-w-0 truncate">{u.nombre}</span>
                    </span>
                  }
                  detalle={u.email}
                  insignia={<EstadoUsuario u={u} />}
                />

                <CamposTarjeta>
                  <CampoTarjeta etiqueta="Roles">{rolesDe(u)}</CampoTarjeta>
                  <CampoTarjeta etiqueta="Acceso">
                    {u.tieneAcceso ? 'Con acceso' : <Insignia tono="aviso">Sin acceso</Insignia>}
                  </CampoTarjeta>
                </CamposTarjeta>

                <AccionesFila
                  nombre={`a ${u.nombre}`}
                  onEditar={() => setModal(u)}
                  extra={accesoDe(u, true)}
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
              <th className={CLASE_TH}>Foto</th>
              <th className={CLASE_TH}>Nombre</th>
              <th className={CLASE_TH}>Email</th>
              <th className={CLASE_TH}>Roles</th>
              <th className={CLASE_TH}>Estado</th>
              <th className={CLASE_TH}>Acceso</th>
              <th className={CLASE_TH}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Todavía no hay usuarios en esta inmobiliaria.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <AvatarUploader
                      nombre={u.nombre}
                      fotoUrl={u.fotoUrl}
                      onUpload={async (file) => {
                        const accessToken = await getAccessToken();
                        await subirFotoUsuario(accessToken, tenantId, u.id, file);
                        router.refresh();
                      }}
                      onRemove={
                        u.fotoUrl
                          ? async () => {
                              const accessToken = await getAccessToken();
                              await eliminarFotoUsuario(accessToken, tenantId, u.id);
                              router.refresh();
                            }
                          : undefined
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-ink">{u.nombre}</td>
                  <td className="px-3 py-2 text-muted">{u.email}</td>
                  <td className="px-3 py-2 text-muted">{rolesDe(u)}</td>
                  <td className="px-3 py-2">
                    <EstadoUsuario u={u} />
                  </td>
                  <td className="px-3 py-2">
                    {!u.tieneAcceso && <Insignia tono="aviso">Sin acceso</Insignia>}
                  </td>
                  {/*
                    El `flex` va en el div de `AccionesFila` y no en la celda:
                    un `<td>` con `display: flex` deja de ser celda y la fila
                    se desalinea.
                  */}
                  <td className="px-3 py-2">
                    <AccionesFila
                      nombre={`a ${u.nombre}`}
                      onEditar={() => setModal(u)}
                      extra={accesoDe(u)}
                    />
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
    </section>
  );
}
