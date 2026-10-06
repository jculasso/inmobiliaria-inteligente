'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIMITE_LISTA, NOMBRE_TIPO_CONTRATO, recortarAlLimite, type ContratoResumenDto } from '@vacker/types';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { paraBuscar } from './buscador';
import { EstadoContratoBadge } from './estado-contrato';
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
  Vacio,
} from './piezas';

const unidad = (c: ContratoResumenDto) => `${c.propiedad.direccion}${c.propiedad.unidad ? ` ${c.propiedad.unidad}` : ''}`;
const nombres = (xs: { nombre: string }[]) => xs.map((x) => x.nombre).join(', ') || '—';

export function ContratosLista({ contratos, hoy }: { contratos: ContratoResumenDto[]; hoy: string }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const { visibles, hayMas } = recortarAlLimite(contratos);

  const filtrados = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return visibles;
    return visibles.filter((c) =>
      [c.codigo, unidad(c), NOMBRE_TIPO_CONTRATO[c.tipo], ...c.inquilinos.map((x) => x.nombre), ...c.propietarios.map((x) => x.nombre)].some((t) =>
        paraBuscar(t).includes(q),
      ),
    );
  }, [visibles, busqueda]);

  const importe = (c: ContratoResumenDto) =>
    c.importeVigente == null ? <span className="text-xs font-bold text-warning">A indexar</span> : fmtMoneda(c.importeVigente, c.moneda);
  const indexacion = (c: ContratoResumenDto) =>
    c.proximaIndexacion == null ? (
      '—'
    ) : (
      <span className={c.proximaIndexacion < hoy ? 'font-semibold text-brand-red' : ''}>
        {fmtFecha(c.proximaIndexacion)}
        {c.proximaIndexacion < hoy ? ' · vencida' : ''}
      </span>
    );
  const abrir = (c: ContratoResumenDto) => router.push(`/alquileres/contratos/${c.id}`);

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
                <Tarjeta key={c.id} onClick={() => abrir(c)} titulo={`Abrir el contrato ${c.codigo}`}>
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
                  <th className={CLASE_TH}>Tipo</th>
                  <th className={CLASE_TH}>Inquilino</th>
                  <th className={CLASE_TH}>Vence</th>
                  <th className={`${CLASE_TH} text-right`}>Importe</th>
                  <th className={CLASE_TH}>Próx. indexación</th>
                  <th className={CLASE_TH}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => abrir(c)} className={CLASE_TR_ABRIBLE}>
                    <td className={CLASE_TD_FIJA}>{c.codigo}</td>
                    <td className={`${CLASE_TD} text-ink`}>
                      <span className="block max-w-[200px] truncate" title={unidad(c)}>
                        {unidad(c)}
                      </span>
                    </td>
                    <td className={`${CLASE_TD} text-muted`}>{NOMBRE_TIPO_CONTRATO[c.tipo]}</td>
                    <td className={`${CLASE_TD} text-muted`}>
                      <span className="block max-w-[160px] truncate" title={nombres(c.inquilinos)}>
                        {nombres(c.inquilinos)}
                      </span>
                    </td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`} title={`Del ${fmtFecha(c.inicio)} al ${fmtFecha(c.fin)}`}>
                      {fmtFecha(c.fin)}
                    </td>
                    <td className={`${CLASE_TD} text-right font-semibold tabular-nums text-ink`}>{importe(c)}</td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{indexacion(c)}</td>
                    <td className={CLASE_TD}>
                      <EstadoContratoBadge estado={c.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
