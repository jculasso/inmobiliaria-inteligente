'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  NOMBRE_TIPO_RECLAMO,
  type ContratoResumenDto,
  type ReclamoResumenDto,
} from '@vacker/types';
import { fmtFechaDe } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { paraBuscar } from './buscador';
import {
  BarraLista,
  BotonNuevo,
  CabezaTarjeta,
  CLASE_LISTA_MOVIL,
  CLASE_TABLA_ANCHA,
  CLASE_TD,
  CLASE_TD_FIJA,
  CLASE_TH,
  CLASE_TR_ABRIBLE,
  EncabezadoPagina,
  LinkFila,
  Segmentado,
  Vacio,
} from './piezas';
import { EstadoReclamoBadge, NuevoReclamoModal, PrioridadBadge } from './reclamos-piezas';

/** Los reclamos (entrega 15): los abiertos primero por prioridad, o todos. */
export function ReclamosLista({
  reclamos,
  contratos,
  estado,
}: {
  reclamos: ReclamoResumenDto[];
  contratos: ContratoResumenDto[];
  estado: 'abiertos' | 'todos';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busqueda, setBusqueda] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const filtrados = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return reclamos;
    return reclamos.filter((r) =>
      [
        String(r.numero),
        r.asunto,
        r.contrato?.codigo,
        r.contrato?.propiedad,
        r.persona?.nombre,
        r.asignadoA,
        r.proveedor?.nombre,
      ].some((t) => paraBuscar(t).includes(q)),
    );
  }, [reclamos, busqueda]);
  const abrir = (r: ReclamoResumenDto) => router.push(`/alquileres/reclamos/${r.id}`);

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Reclamos">
        <Segmentado
          etiqueta="Qué reclamos"
          opciones={[
            ['abiertos', 'Abiertos'],
            ['todos', 'Todos'],
          ]}
          valor={estado}
          onCambio={(v) => router.push(v === 'abiertos' ? pathname : `${pathname}?estado=todos`)}
        />
      </EncabezadoPagina>
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por número, asunto, contrato, persona o proveedor…"
        visibles={filtrados.length}
        total={reclamos.length}
        nombre="reclamos"
      >
        <BotonNuevo onClick={() => setNuevo(true)}>Nuevo reclamo</BotonNuevo>
      </BarraLista>
      {reclamos.length === 0 ? (
        <Vacio>
          {estado === 'abiertos'
            ? 'No hay reclamos abiertos. 🎉'
            : 'Todavía no se cargó ningún reclamo.'}
        </Vacio>
      ) : filtrados.length === 0 ? (
        <Vacio>Ningún reclamo coincide con «{busqueda}».</Vacio>
      ) : (
        <>
          <div className={CLASE_LISTA_MOVIL}>
            <ListaTarjetas etiqueta="Reclamos">
              {filtrados.map((r) => (
                <Tarjeta
                  key={r.id}
                  onClick={() => abrir(r)}
                  titulo={`Abrir el reclamo ${r.numero}`}
                >
                  <CabezaTarjeta
                    titulo={r.asunto}
                    detalle={`N.º ${r.numero} · ${fmtFechaDe(r.abierto)}`}
                    insignia={<EstadoReclamoBadge estado={r.estado} />}
                  />
                  <CamposTarjeta>
                    <CampoTarjeta etiqueta="Contrato">
                      {r.contrato ? `${r.contrato.codigo} · ${r.contrato.propiedad}` : '—'}
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta="Prioridad">
                      <PrioridadBadge prioridad={r.prioridad} corta />
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta="De">{r.persona?.nombre ?? '—'}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Lo sigue">{r.asignadoA ?? 'Sin asignar'}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Proveedor">
                      {r.proveedor?.nombre ?? 'Sin proveedor'}
                    </CampoTarjeta>
                  </CamposTarjeta>
                </Tarjeta>
              ))}
            </ListaTarjetas>
          </div>
          <div className={CLASE_TABLA_ANCHA}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${CLASE_TH} left-0 z-30 border-r`}>N.º</th>
                  <th className={CLASE_TH}>Asunto</th>
                  <th className={CLASE_TH}>Contrato</th>
                  <th className={CLASE_TH}>De</th>
                  <th className={CLASE_TH}>Tipo</th>
                  <th className={CLASE_TH}>Prioridad</th>
                  <th className={CLASE_TH}>Estado</th>
                  <th className={CLASE_TH}>Lo sigue</th>
                  <th className={CLASE_TH}>Proveedor</th>
                  <th className={CLASE_TH}>Abierto</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.id} onClick={() => abrir(r)} className={CLASE_TR_ABRIBLE}>
                    <td className={CLASE_TD_FIJA}>
                      <LinkFila
                        href={`/alquileres/reclamos/${r.id}`}
                        etiqueta={`Reclamo ${r.numero}: ${r.asunto}`}
                      >
                        {r.numero}
                      </LinkFila>
                    </td>
                    <td className={`${CLASE_TD} text-ink`}>
                      <span className="block max-w-[260px] truncate font-semibold" title={r.asunto}>
                        {r.asunto}
                      </span>
                    </td>
                    <td className={`${CLASE_TD} text-muted`}>
                      {r.contrato ? `${r.contrato.codigo} · ${r.contrato.propiedad}` : '—'}
                    </td>
                    <td className={`${CLASE_TD} text-muted`}>{r.persona?.nombre ?? '—'}</td>
                    <td className={`${CLASE_TD} text-muted`}>{NOMBRE_TIPO_RECLAMO[r.tipo]}</td>
                    <td className={CLASE_TD}>
                      <PrioridadBadge prioridad={r.prioridad} corta />
                    </td>
                    <td className={CLASE_TD}>
                      <EstadoReclamoBadge estado={r.estado} />
                    </td>
                    <td className={`${CLASE_TD} text-muted`}>{r.asignadoA ?? 'Sin asignar'}</td>
                    <td className={`${CLASE_TD} text-muted`}>
                      {r.proveedor?.nombre ?? 'Sin proveedor'}
                    </td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>
                      {fmtFechaDe(r.abierto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {nuevo && (
        <NuevoReclamoModal
          contratos={contratos}
          onClose={() => setNuevo(false)}
          onCreado={(id) => router.push(`/alquileres/reclamos/${id}`)}
        />
      )}
    </div>
  );
}
