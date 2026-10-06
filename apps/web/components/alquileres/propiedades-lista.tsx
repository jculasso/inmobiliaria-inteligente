'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, recortarAlLimite, type PropiedadAlquilerDto } from '@vacker/types';
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
import { NOMBRE_TIPO_PROPIEDAD, PropiedadFormModal } from './propiedad-form-modal';
import { getAccessToken } from '../../lib/supabase/client';
import { borrarPropiedadAlquiler } from '../../lib/alquileres-api';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';

export function PropiedadesLista({ propiedades }: { propiedades: PropiedadAlquilerDto[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'nueva' | PropiedadAlquilerDto | null>(null);
  const [aBorrar, setABorrar] = useState<PropiedadAlquilerDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(propiedades);

  const filtradas = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((p) => [p.direccion, p.unidad, p.ciudad].some((c) => paraBuscar(c).includes(q)));
  }, [visibles, busqueda]);

  const guardado = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Propiedades" />

      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por dirección o ciudad…"
        visibles={filtradas.length}
        total={visibles.length}
        nombre="propiedades"
      >
        <BotonNuevo onClick={() => setModal('nueva')}>Nueva propiedad</BotonNuevo>
      </BarraLista>

      {hayMas && (
        <p role="status" className="text-sm text-muted">
          Se muestran las primeras {LIMITE_LISTA} propiedades por dirección.
        </p>
      )}

      {propiedades.length === 0 ? (
        <Vacio>Todavía no hay propiedades cargadas.</Vacio>
      ) : filtradas.length === 0 ? (
        <Vacio>Ninguna propiedad coincide con «{busqueda}».</Vacio>
      ) : (
        <>
          <div className={CLASE_LISTA_MOVIL}>
            <ListaTarjetas etiqueta="Propiedades">
              {filtradas.map((p) => (
                <Tarjeta key={p.id}>
                  <button type="button" onClick={() => setModal(p)} title={`Editar ${p.direccion}`} className="block w-full text-left">
                    <CabezaTarjeta titulo={`${p.direccion}${p.unidad ? ` ${p.unidad}` : ''}`} detalle={p.ciudad ?? undefined} />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Tipo">{p.tipo ? NOMBRE_TIPO_PROPIEDAD[p.tipo] : '—'}</CampoTarjeta>
                    </CamposTarjeta>
                  </button>
                  <AccionesFila tarjeta nombre={p.direccion} onEditar={() => setModal(p)} onBorrar={() => setABorrar(p)} />
                </Tarjeta>
              ))}
            </ListaTarjetas>
          </div>
          <div className={CLASE_TABLA_ANCHA}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={CLASE_TH}>Dirección</th>
                  <th className={CLASE_TH}>Piso / depto</th>
                  <th className={CLASE_TH}>Ciudad</th>
                  <th className={CLASE_TH}>Tipo</th>
                  <th className={CLASE_TH_ACCIONES} />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr key={p.id} onClick={() => setModal(p)} className={CLASE_TR_ABRIBLE}>
                    <td className={`${CLASE_TD} font-semibold text-ink`}>{p.direccion}</td>
                    <td className={`${CLASE_TD} text-muted`}>{p.unidad ?? '—'}</td>
                    <td className={`${CLASE_TD} text-muted`}>{p.ciudad ?? '—'}</td>
                    <td className={`${CLASE_TD} text-muted`}>{p.tipo ? NOMBRE_TIPO_PROPIEDAD[p.tipo] : '—'}</td>
                    <td className={CLASE_TD_ACCIONES}>
                      <AccionesFila nombre={p.direccion} onEditar={() => setModal(p)} onBorrar={() => setABorrar(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <PropiedadFormModal propiedad={modal === 'nueva' ? undefined : modal} onClose={() => setModal(null)} onSaved={guardado} />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar ${aBorrar.direccion}${aBorrar.unidad ? ` ${aBorrar.unidad}` : ''}`}
          descripcion="Se borra solo si nunca tuvo un contrato. Si lo tuvo, queda: es parte de la historia."
          detalle={
            <>
              <DatoBorrado etiqueta="Ciudad">{aBorrar.ciudad ?? '—'}</DatoBorrado>
              <DatoBorrado etiqueta="Tipo">{aBorrar.tipo ? NOMBRE_TIPO_PROPIEDAD[aBorrar.tipo] : '—'}</DatoBorrado>
            </>
          }
          onConfirm={async () => {
            await borrarPropiedadAlquiler(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </div>
  );
}
