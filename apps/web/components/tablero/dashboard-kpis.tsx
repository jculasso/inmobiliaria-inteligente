'use client';

import { useState } from 'react';
import type { AgregadoKpi, LadoPunta, OperacionFiltro, ResumenKpis } from '@vacker/types';
import { KpiCard } from '@vacker/ui';
import { fmtNum, fmtUSD } from '../../lib/format';
import { NOMBRES_MES } from '../../lib/meses';
import type { FocoDrill } from '../../lib/drill';
import { DetalleDrillModal } from './detalle-drill-modal';
import { TituloSeccion } from '../piezas';

interface Drill {
  titulo: string;
  subtitulo: string;
  filtro: OperacionFiltro;
  foco?: FocoDrill;
  lado?: LadoPunta;
}

/**
 * KPIs de cabecera del dashboard (mes seleccionado, acumulado anual, pendiente
 * de cobro, alquileres). Cliente porque cada tarjeta abre el detalle crudo de
 * operaciones (`DetalleDrillModal`), réplica del `openDrill()` del prototipo.
 */
export function DashboardKpis({
  resumen,
  anio,
  mes,
  verTodo,
  verAlquileres,
}: {
  resumen: ResumenKpis;
  anio: number;
  mes: number;
  verTodo?: boolean;
  /**
   * Si la persona ve los alquileres de la inmobiliaria. Lo decide
   * `puedeVerAlquileres` en el servidor; acá solo se obedece. Quien no los ve
   * no recibe una tarjeta en 0, que parecía un error: no recibe la tarjeta.
   */
  verAlquileres: boolean;
}) {
  const [drill, setDrill] = useState<Drill | null>(null);

  function cards(agg: AgregadoKpi, filtro: OperacionFiltro, periodoLabel: string) {
    /*
     * Cada tarjeta abre las operaciones que ELLA cuenta. Escrituradas, porque
     * el agregado sale de `ventas(tx, anio, 'escriturada')`; y si la tarjeta es
     * de un lado, solo las puntas de ese lado. Antes las ocho abrían la misma
     * lista —todas las ventas, de cualquier estado, con la comisión entera— y
     * ninguna coincidía con su número. Ver `lib/drill.ts`.
     */
    const abrir = (titulo: string, foco: FocoDrill, lado?: LadoPunta) => () =>
      setDrill({
        titulo,
        subtitulo: `Ventas escrituradas · ${periodoLabel}`,
        filtro: { ...filtro, tipo: 'venta', estado: 'escriturada' },
        foco,
        lado,
      });
    /*
     * Ocho tarjetas, en dos filas de cuatro. Eran seis en una fila de seis; al
     * abrir la comisión por lado, seis columnas dejaban los números apretados
     * y la fila no cerraba.
     */
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Volumen"
          value={fmtUSD(agg.volumen)}
          icon="💰"
          tone="brand"
          onClick={abrir('Volumen', 'volumen')}
        />
        <KpiCard
          label="Operaciones"
          value={fmtNum(agg.operaciones)}
          sub={`${fmtNum(agg.puntas)} puntas`}
          icon="🏠"
          onClick={abrir('Operaciones', 'operaciones')}
        />
        <KpiCard
          label="Ticket prom."
          value={fmtUSD(agg.ticketPromedio)}
          icon="🎯"
          onClick={abrir('Ticket promedio', 'ticket')}
        />
        <KpiCard
          label="Puntas compradoras"
          value={fmtNum(agg.puntasCompradoras)}
          icon="🤝"
          onClick={abrir('Puntas compradoras', 'puntas', 'compradora')}
        />
        <KpiCard
          label="Puntas vendedoras"
          value={fmtNum(agg.puntasVendedoras)}
          icon="🧑‍💼"
          onClick={abrir('Puntas vendedoras', 'puntas', 'vendedora')}
        />
        <KpiCard
          label="Comisión"
          value={fmtUSD(agg.comision)}
          icon="💵"
          tone="success"
          onClick={abrir('Comisión', 'comision')}
        />
        {/*
          La comisión abierta por lado, como la mira Vacker en su planilla: qué
          parte abonó el comprador y qué parte el vendedor. Las dos suman la
          tarjeta de «Comisión» de al lado.
        */}
        <KpiCard
          label="Com. comprador"
          value={fmtUSD(agg.comisionCompradora)}
          sub={`${fmtNum(agg.puntasCompradoras)} puntas`}
          icon="🤝"
          onClick={abrir('Comisión del comprador', 'comision', 'compradora')}
        />
        <KpiCard
          label="Com. vendedor"
          value={fmtUSD(agg.comisionVendedora)}
          sub={`${fmtNum(agg.puntasVendedoras)} puntas`}
          icon="🧑‍💼"
          onClick={abrir('Comisión del vendedor', 'comision', 'vendedora')}
        />
      </div>
    );
  }

  return (
    <>
      {resumen.mesActual && (
        <section className="flex flex-col gap-2">
          <TituloSeccion icono="🗓️">Mes seleccionado</TituloSeccion>
          {cards(resumen.mesActual, { anio, mes, verTodo }, `${NOMBRES_MES[mes - 1]} ${anio}`)}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <TituloSeccion icono="📅">{`Acumulado año ${anio}`}</TituloSeccion>
        {cards(resumen.anual, { anio, verTodo }, `Año ${anio}`)}
      </section>

      <div className={`grid grid-cols-1 gap-3 ${verAlquileres ? 'sm:grid-cols-2' : ''}`}>
        <KpiCard
          label="Pendiente de cobro"
          value={fmtUSD(resumen.pendienteCobro)}
          sub={`${fmtNum(resumen.operacionesSenadas)} operaciones señadas`}
          icon="⏳"
          tone="warning"
          onClick={() =>
            setDrill({
              titulo: 'Pendiente de cobro',
              subtitulo: `Operaciones señadas · Año ${anio}`,
              filtro: { anio, tipo: 'venta', estado: 'senada', verTodo },
              foco: 'comision',
            })
          }
        />
        {verAlquileres && (
          <KpiCard
            label={`Alquileres firmados · ${anio}`}
            value={fmtNum(resumen.alquileres.firmados)}
            sub={`${fmtUSD(resumen.alquileres.comision)} comisión · ${fmtUSD(resumen.alquileres.valorMensualPromedio)} prom./mes`}
            icon="🔑"
            onClick={() =>
              setDrill({
                titulo: 'Alquileres firmados',
                subtitulo: `Año ${anio}`,
                /*
                 * `verTodo: true` SIEMPRE, no el tilde de la pantalla. El
                 * listado filtra por puntas cuando el alcance es «lo mío», y
                 * los alquileres no tienen puntas: un director sin tildar «Ver
                 * todo» veía 35 en la tarjeta y una lista vacía al tocarla.
                 *
                 * No abre nada de más: el servidor evalúa `verTodo` según el
                 * rol, y esta tarjeta solo existe para quien puede ver los
                 * alquileres de toda la inmobiliaria.
                 */
                filtro: { anio, tipo: 'alquiler', estado: 'firmado', verTodo: true },
                foco: 'operaciones',
              })
            }
          />
        )}
      </div>

      {drill && (
        <DetalleDrillModal
          titulo={drill.titulo}
          subtitulo={drill.subtitulo}
          filtro={drill.filtro}
          foco={drill.foco}
          lado={drill.lado}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}
