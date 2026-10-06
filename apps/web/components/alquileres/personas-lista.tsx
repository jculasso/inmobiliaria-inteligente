'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, recortarAlLimite, type PersonaDto } from '@vacker/types';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { paraBuscar } from './buscador';
import {
  AccionesFila,
  BarraLista,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  Vacio,
} from './piezas';
import { PersonaFormModal } from './persona-form-modal';
import { getAccessToken } from '../../lib/supabase/client';
import { borrarPersona } from '../../lib/alquileres-api';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';

/** Documento con formato legible: DNI con puntos, CUIT con guiones. */
export function documentoLegible(doc: string | null): string {
  if (!doc) return '—';
  if (doc.length === 11) return `${doc.slice(0, 2)}-${doc.slice(2, 10)}-${doc.slice(10)}`;
  return doc.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function PersonasLista({ personas }: { personas: PersonaDto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'nueva' | PersonaDto | null>(null);
  const [aBorrar, setABorrar] = useState<PersonaDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(personas);

  const filtradas = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((p) => [p.nombre, p.documento, p.email, p.telefono].some((c) => paraBuscar(c).includes(q)));
  }, [visibles, busqueda]);

  // La fila abre la cuenta corriente; los datos se editan desde ahí.
  const abrir = (p: PersonaDto) => router.push(`/alquileres/personas/${p.id}`);

  const guardado = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Personas" />

      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por nombre o documento…"
        visibles={filtradas.length}
        total={visibles.length}
        nombre="personas"
      >
        <BotonNuevo onClick={() => setModal('nueva')}>Nueva persona</BotonNuevo>
      </BarraLista>

      {hayMas && (
        <p role="status" className="text-sm text-muted">
          Se muestran las primeras {LIMITE_LISTA} personas por orden alfabético.
        </p>
      )}

      {personas.length === 0 ? (
        <Vacio>Todavía no hay personas cargadas. Empezá por los propietarios.</Vacio>
      ) : filtradas.length === 0 ? (
        <Vacio>Nadie coincide con «{busqueda}».</Vacio>
      ) : (
        <>
          <div className={CLASE_LISTA_MOVIL}>
            <ListaTarjetas etiqueta="Personas">
              {filtradas.map((p) => (
                <Tarjeta key={p.id}>
                  <button type="button" onClick={() => abrir(p)} title={`Abrir la cuenta de ${p.nombre}`} className="block w-full text-left">
                    <CabezaTarjeta titulo={p.nombre} detalle={documentoLegible(p.documento)} />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Teléfono">{p.telefono ?? '—'}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Email">{p.email ?? '—'}</CampoTarjeta>
                    </CamposTarjeta>
                  </button>
                  <AccionesFila tarjeta nombre={p.nombre} onEditar={() => setModal(p)} onBorrar={() => setABorrar(p)} />
                </Tarjeta>
              ))}
            </ListaTarjetas>
          </div>
          <div className={CLASE_TABLA_ANCHA}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={CLASE_TH}>Nombre</th>
                  <th className={CLASE_TH}>Documento</th>
                  <th className={CLASE_TH}>Email</th>
                  <th className={CLASE_TH}>Teléfono</th>
                  <th className={CLASE_TH_ACCIONES} />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr key={p.id} onClick={() => abrir(p)} className={CLASE_TR_ABRIBLE}>
                    <td className={`${CLASE_TD} font-semibold text-ink`}>{p.nombre}</td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{documentoLegible(p.documento)}</td>
                    <td className={`${CLASE_TD} text-muted`}>{p.email ?? '—'}</td>
                    <td className={`${CLASE_TD} text-muted`}>{p.telefono ?? '—'}</td>
                    <td className={CLASE_TD_ACCIONES}>
                      <AccionesFila nombre={p.nombre} onEditar={() => setModal(p)} onBorrar={() => setABorrar(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <PersonaFormModal persona={modal === 'nueva' ? undefined : modal} onClose={() => setModal(null)} onSaved={guardado} />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar a ${aBorrar.nombre}`}
          descripcion="Se borra solo si no tiene historia: ningún contrato, cobro ni liquidación. Si la tiene, queda, y te decimos qué tiene."
          detalle={
            <>
              <DatoBorrado etiqueta="Documento">{documentoLegible(aBorrar.documento)}</DatoBorrado>
              <DatoBorrado etiqueta="Teléfono">{aBorrar.telefono ?? '—'}</DatoBorrado>
            </>
          }
          onConfirm={async () => {
            await borrarPersona(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}
