'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LIMITE_LISTA,
  NOMBRE_TIPO_CONTRATO,
  recortarAlLimite,
  type ContratoResumenDto,
} from '@vacker/types';
import { getAccessToken } from '../../lib/supabase/client';
import { anularContrato, borrarContrato } from '../../lib/alquileres-api';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AnularModal } from './anular-modal';
import { DatosContratoModal } from './datos-contrato-modal';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { paraBuscar } from './buscador';
import { EstadoContratoBadge } from './estado-contrato';
import {
  AccionesFila,
  BarraLista,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_FOCO,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TD,
  CLASE_TD_ACCIONES,
  CLASE_TH_ACCIONES,
  CLASE_TD_FIJA,
  CLASE_TH,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  LinkFila,
  Vacio,
} from './piezas';

const unidad = (c: ContratoResumenDto) =>
  `${c.propiedad.direccion}${c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}`;
const nombres = (xs: { nombre: string }[]) => xs.map((x) => x.nombre).join(', ') || '—';

export function ContratosLista({
  contratos,
  hoy,
}: {
  contratos: ContratoResumenDto[];
  hoy: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [aBorrar, setABorrar] = useState<ContratoResumenDto | null>(null);
  const [aAnular, setAAnular] = useState<ContratoResumenDto | null>(null);
  const [aEditar, setAEditar] = useState<ContratoResumenDto | null>(null);
  const { visibles, hayMas } = recortarAlLimite(contratos);

  const filtrados = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((c) =>
      [
        c.codigo,
        unidad(c),
        NOMBRE_TIPO_CONTRATO[c.tipo],
        ...c.inquilinos.map((x) => x.nombre),
        ...c.propietarios.map((x) => x.nombre),
      ].some((t) => paraBuscar(t).includes(q)),
    );
  }, [visibles, busqueda]);

  // Lo anulado, como en todo el módulo: insignia gris e importe tachado (regla 19: «queda tachado»).
  const importe = (c: ContratoResumenDto) =>
    c.importeVigente == null ? (
      <span className="text-xs font-bold text-warning">A indexar</span>
    ) : (
      <span className={c.estado === 'anulado' ? 'text-muted line-through' : ''}>
        {fmtMoneda(c.importeVigente, c.moneda)}
      </span>
    );
  const indexacion = (c: ContratoResumenDto) =>
    c.proximaIndexacion == null ? (
      '—'
    ) : (
      // Si ya empezó pero el índice no salió, no está vencida: espera el índice (regla 7).
      <span
        className={
          c.proximaIndexacion < hoy && !c.proximaIndexacionEspera ? 'font-semibold text-danger' : ''
        }
      >
        {fmtFecha(c.proximaIndexacion)}
        {c.proximaIndexacion < hoy &&
          (c.proximaIndexacionEspera ? (
            // En su propia línea: al lado de la fecha no entraba y se cortaba bajo los íconos.
            <span className="block text-xs text-muted">espera el índice</span>
          ) : (
            ' · vencida'
          ))}
      </span>
    );
  const abrir = (c: ContratoResumenDto) => router.push(`/alquileres/contratos/${c.id}`);
  // Decidido con Javier el 6/10/2026: el borrador se edita completo y se borra;
  // el vigente edita lo que no toca plata; con historia, se anula.
  const editar = (c: ContratoResumenDto) =>
    c.estado === 'borrador'
      ? () => router.push(`/alquileres/contratos/${c.id}/editar`)
      : c.estado === 'vigente'
        ? () => setAEditar(c)
        : undefined;
  const borrar = (c: ContratoResumenDto) =>
    c.estado === 'borrador'
      ? () => setABorrar(c)
      : c.estado === 'anulado'
        ? undefined
        : () => setAAnular(c);
  const listo = () => {
    setABorrar(null);
    setAAnular(null);
    setAEditar(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Contratos" />

      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por código, dirección o persona…"
        visibles={filtrados.length}
        total={visibles.length}
        nombre="contratos"
      >
        <BotonNuevo href="/alquileres/contratos/nuevo">Nuevo contrato</BotonNuevo>
      </BarraLista>

      {hayMas && (
        <p role="status" className="text-sm text-muted">
          Se muestran los primeros {LIMITE_LISTA} contratos.
        </p>
      )}

      {contratos.length === 0 ? (
        <Vacio>Todavía no hay contratos cargados.</Vacio>
      ) : filtrados.length === 0 ? (
        <Vacio>Ningún contrato coincide con «{busqueda}».</Vacio>
      ) : (
        <>
          <div className={CLASE_LISTA_MOVIL}>
            <ListaTarjetas etiqueta="Contratos">
              {filtrados.map((c) => (
                <Tarjeta key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrir(c)}
                    title={`Abrir el contrato ${c.codigo}`}
                    className={`block w-full rounded text-left ${CLASE_FOCO}`}
                  >
                    <CabezaTarjeta
                      titulo={unidad(c)}
                      detalle={`${c.codigo} · ${NOMBRE_TIPO_CONTRATO[c.tipo]} · hasta ${fmtFecha(c.fin)}`}
                      insignia={<EstadoContratoBadge estado={c.estado} />}
                    />
                    <CamposTarjeta>
                      <CampoTarjeta etiqueta="Inquilino">{nombres(c.inquilinos)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Importe">{importe(c)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Propietario">{nombres(c.propietarios)}</CampoTarjeta>
                      <CampoTarjeta etiqueta="Indexación">{indexacion(c)}</CampoTarjeta>
                    </CamposTarjeta>
                  </button>
                  <AccionesFila
                    tarjeta
                    nombre={`el contrato ${c.codigo}`}
                    onEditar={editar(c)}
                    onBorrar={borrar(c)}
                    anula={c.estado !== 'borrador'}
                  />
                </Tarjeta>
              ))}
            </ListaTarjetas>
          </div>
          <div className={CLASE_TABLA_ANCHA}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${CLASE_TH} left-0 z-30 border-r`}>Código</th>
                  <th className={CLASE_TH}>Propiedad</th>
                  {/* Debajo de 1280 px la tabla no entraba y «Estado» quedaba tapado por los íconos;
                      el tipo también se ve en la ficha y en el filtro del Dashboard. */}
                  <th className={`${CLASE_TH} hidden xl:table-cell`}>Tipo</th>
                  <th className={CLASE_TH}>Inquilino</th>
                  <th className={CLASE_TH}>Vence</th>
                  <th className={`${CLASE_TH} text-right`}>Importe</th>
                  <th className={CLASE_TH}>Próx. indexación</th>
                  <th className={CLASE_TH}>Estado</th>
                  <th className={CLASE_TH_ACCIONES} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => abrir(c)} className={CLASE_TR_ABRIBLE}>
                    <td className={CLASE_TD_FIJA}>
                      <LinkFila href={`/alquileres/contratos/${c.id}`}>{c.codigo}</LinkFila>
                    </td>
                    <td className={`${CLASE_TD} text-ink`}>
                      <span className="block max-w-[200px] truncate" title={unidad(c)}>
                        {unidad(c)}
                      </span>
                    </td>
                    <td className={`${CLASE_TD} hidden text-muted xl:table-cell`}>
                      {NOMBRE_TIPO_CONTRATO[c.tipo]}
                    </td>
                    <td className={`${CLASE_TD} text-muted`}>
                      <span className="block max-w-[160px] truncate" title={nombres(c.inquilinos)}>
                        {nombres(c.inquilinos)}
                      </span>
                    </td>
                    <td
                      className={`${CLASE_TD} tabular-nums text-muted`}
                      title={`Del ${fmtFecha(c.inicio)} al ${fmtFecha(c.fin)}`}
                    >
                      {fmtFecha(c.fin)}
                    </td>
                    <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>
                      {importe(c)}
                    </td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{indexacion(c)}</td>
                    <td className={CLASE_TD}>
                      <EstadoContratoBadge estado={c.estado} />
                    </td>
                    <td className={CLASE_TD_ACCIONES}>
                      <AccionesFila
                        nombre={`el contrato ${c.codigo}`}
                        onEditar={editar(c)}
                        onBorrar={borrar(c)}
                        anula={c.estado !== 'borrador'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar el contrato ${aBorrar.codigo}`}
          descripcion="Está en borrador: todavía no generó nada. Se borra con sus partes y tramos; el historial guarda que existió y quién lo borró."
          detalle={
            <>
              <DatoBorrado etiqueta="Propiedad">{unidad(aBorrar)}</DatoBorrado>
              <DatoBorrado etiqueta="Inquilino">{nombres(aBorrar.inquilinos)}</DatoBorrado>
              <DatoBorrado etiqueta="Propietario">{nombres(aBorrar.propietarios)}</DatoBorrado>
            </>
          }
          onConfirm={async () => {
            await borrarContrato(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
      {aAnular && (
        <AnularModal
          titulo={`Anular el contrato ${aAnular.codigo}`}
          detalle={`${unidad(aAnular)} · ${nombres(aAnular.inquilinos)}. Tiene historia: no se borra, queda anulado y tachado, con el motivo. Sus conceptos pendientes se anulan. Si ya tiene cobros o liquidaciones, primero hay que anular esos.`}
          anular={async (motivo) => anularContrato(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={listo}
        />
      )}
      {aEditar && (
        <DatosContratoModal
          contratoId={aEditar.id}
          onClose={() => setAEditar(null)}
          onSaved={listo}
        />
      )}
    </div>
  );
}
