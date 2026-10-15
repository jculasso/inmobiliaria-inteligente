'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  EstadoReservaSchema,
  NOMBRE_ESTADO_RESERVA,
  NOMBRE_TIPO_CONTRATO,
  type FiltroReservas,
  type ReservaResumenDto,
} from '@vacker/types';
import { fmtFecha } from '../../lib/format';
import { inputClass } from '../form-ui';
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
  Vacio,
} from './piezas';
import { EstadoReservaBadge, SenaCorta, VenceReserva } from './reservas-piezas';

const unidad = (p: { direccion: string; unidad: string | null }) =>
  [p.direccion, p.unidad].filter(Boolean).join(' ');

/** Las opciones del filtro: abiertas (por defecto), todas, o un estado. */
const FILTROS: [FiltroReservas, string][] = [
  ['abiertas', 'Abiertas'],
  ['todas', 'Todas'],
  ...EstadoReservaSchema.options.map((e): [FiltroReservas, string] => [
    e,
    NOMBRE_ESTADO_RESERVA[e],
  ]),
];

/**
 * Las reservas (regla 164): abre en las abiertas y filtra por estado. En la
 * computadora una tabla; en el teléfono, tarjetas (`ListaTarjetas` es
 * `sm:hidden` a propósito: va con la tabla).
 */
export function ReservasLista({
  reservas,
  filtro,
  hoy,
}: {
  reservas: ReservaResumenDto[];
  filtro: FiltroReservas;
  hoy: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busqueda, setBusqueda] = useState('');
  const filtradas = useMemo(() => {
    const q = paraBuscar(busqueda.trim());
    if (!q) return reservas;
    return reservas.filter((r) =>
      [
        String(r.numero),
        unidad(r.propiedad),
        ...r.interesados.map((i) => i.nombre),
        r.contrato?.codigo,
      ].some((t) => paraBuscar(t).includes(q)),
    );
  }, [reservas, busqueda]);
  const abrir = (r: ReservaResumenDto) => router.push(`/alquileres/reservas/${r.id}`);
  const interesados = (r: ReservaResumenDto) =>
    r.interesados.map((i) => i.nombre).join(', ') || '—';

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Reservas">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Ver</span>
          <select
            aria-label="Qué reservas"
            className={`${inputClass} w-auto`}
            value={filtro}
            onChange={(e) =>
              router.push(
                e.target.value === 'abiertas' ? pathname : `${pathname}?estado=${e.target.value}`,
              )
            }
          >
            {FILTROS.map(([v, texto]) => (
              <option key={v} value={v}>
                {texto}
              </option>
            ))}
          </select>
        </label>
      </EncabezadoPagina>
      <BarraLista
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar por número, propiedad, interesado o contrato…"
        visibles={filtradas.length}
        total={reservas.length}
        nombre="reservas"
      >
        <BotonNuevo href="/alquileres/reservas/nueva">Nueva reserva</BotonNuevo>
      </BarraLista>
      {reservas.length === 0 ? (
        <Vacio>
          {filtro === 'abiertas'
            ? 'No hay reservas abiertas.'
            : filtro === 'todas'
              ? 'Todavía no se cargó ninguna reserva.'
              : `No hay reservas en «${NOMBRE_ESTADO_RESERVA[filtro]}».`}
        </Vacio>
      ) : filtradas.length === 0 ? (
        <Vacio>Ninguna reserva coincide con «{busqueda}».</Vacio>
      ) : (
        <>
          <div className={CLASE_LISTA_MOVIL}>
            <ListaTarjetas etiqueta="Reservas">
              {filtradas.map((r) => (
                <Tarjeta
                  key={r.id}
                  onClick={() => abrir(r)}
                  titulo={`Abrir la reserva ${r.numero}`}
                >
                  <CabezaTarjeta
                    titulo={unidad(r.propiedad)}
                    detalle={`Reserva ${r.numero} · ${fmtFecha(r.fecha)}`}
                    insignia={<EstadoReservaBadge estado={r.estado} />}
                  />
                  <CamposTarjeta>
                    <CampoTarjeta etiqueta="Interesado">{interesados(r)}</CampoTarjeta>
                    <CampoTarjeta etiqueta="Vence">
                      <VenceReserva vence={r.vence} estado={r.estado} hoy={hoy} />
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta="Seña">
                      <SenaCorta sena={r.sena} />
                    </CampoTarjeta>
                    <CampoTarjeta etiqueta="Contrato">{r.contrato?.codigo ?? '—'}</CampoTarjeta>
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
                  <th className={CLASE_TH}>Propiedad</th>
                  <th className={CLASE_TH}>Interesado</th>
                  <th className={CLASE_TH}>Tipo</th>
                  <th className={CLASE_TH}>Fecha</th>
                  <th className={CLASE_TH}>Vence</th>
                  <th className={CLASE_TH}>Seña</th>
                  <th className={CLASE_TH}>Estado</th>
                  <th className={CLASE_TH}>Contrato</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r.id} onClick={() => abrir(r)} className={CLASE_TR_ABRIBLE}>
                    <td className={CLASE_TD_FIJA}>
                      <LinkFila
                        href={`/alquileres/reservas/${r.id}`}
                        etiqueta={`Reserva ${r.numero}: ${unidad(r.propiedad)}`}
                      >
                        {r.numero}
                      </LinkFila>
                    </td>
                    <td className={`${CLASE_TD} font-semibold text-ink`}>{unidad(r.propiedad)}</td>
                    <td className={`${CLASE_TD} text-muted`}>{interesados(r)}</td>
                    <td className={`${CLASE_TD} text-muted`}>{NOMBRE_TIPO_CONTRATO[r.tipo]}</td>
                    <td className={`${CLASE_TD} tabular-nums text-muted`}>{fmtFecha(r.fecha)}</td>
                    <td className={CLASE_TD}>
                      <VenceReserva vence={r.vence} estado={r.estado} hoy={hoy} />
                    </td>
                    <td className={`${CLASE_TD} text-ink`}>
                      <SenaCorta sena={r.sena} />
                    </td>
                    <td className={CLASE_TD}>
                      <EstadoReservaBadge estado={r.estado} />
                    </td>
                    <td className={`${CLASE_TD} text-muted`}>{r.contrato?.codigo ?? '—'}</td>
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
