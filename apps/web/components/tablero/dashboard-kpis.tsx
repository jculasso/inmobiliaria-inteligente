'use client';

import { useState } from 'react';
import type { AgregadoKpi, OperacionFiltro, ResumenKpis } from '@vacker/types';
import { fmtNum, fmtUSD } from '../../lib/format';
import { KpiCard } from './kpi-card';
import { DetalleDrillModal } from './detalle-drill-modal';

interface Drill {
  titulo: string;
  subtitulo: string;
  filtro: OperacionFiltro;
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
}: {
  resumen: ResumenKpis;
  anio: number;
  mes: number;
}) {
  const [drill, setDrill] = useState<Drill | null>(null);

  function cards(agg: AgregadoKpi, filtro: OperacionFiltro, periodoLabel: string) {
    const abrir = (label: string) => () =>
      setDrill({ titulo: label, subtitulo: `Ventas · ${periodoLabel}`, filtro: { ...filtro, tipo: 'venta' } });
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Volumen" value={fmtUSD(agg.volumen)} icon="💰" tone="brand" onClick={abrir('Volumen')} />
        <KpiCard
          label="Operaciones"
          value={fmtNum(agg.operaciones)}
          sub={`${fmtNum(agg.puntas)} puntas`}
          icon="🏠"
          onClick={abrir('Operaciones')}
        />
        <KpiCard
          label="Ticket prom."
          value={fmtUSD(agg.ticketPromedio)}
          icon="🎯"
          onClick={abrir('Ticket promedio')}
        />
        <KpiCard
          label="Puntas compradoras"
          value={fmtNum(agg.puntasCompradoras)}
          icon="🤝"
          onClick={abrir('Puntas compradoras')}
        />
        <KpiCard
          label="Puntas vendedoras"
          value={fmtNum(agg.puntasVendedoras)}
          icon="🧑‍💼"
          onClick={abrir('Puntas vendedoras')}
        />
        <KpiCard label="Comisión" value={fmtUSD(agg.comision)} icon="💵" tone="success" onClick={abrir('Comisión')} />
      </div>
    );
  }

  return (
    <>
      {resumen.mesActual && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Mes seleccionado</p>
          {cards(resumen.mesActual, { anio, mes }, `mes ${mes}/${anio}`)}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Acumulado año {anio}</p>
        {cards(resumen.anual, { anio }, `año ${anio}`)}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              filtro: { anio, tipo: 'venta', estado: 'senada' },
            })
          }
        />
        <KpiCard
          label={`Alquileres firmados · ${anio}`}
          value={fmtNum(resumen.alquileres.firmados)}
          sub={`${fmtUSD(resumen.alquileres.comision)} comisión · ${fmtUSD(resumen.alquileres.valorMensualPromedio)} prom./mes`}
          icon="🔑"
          onClick={() =>
            setDrill({
              titulo: 'Alquileres firmados',
              subtitulo: `Año ${anio}`,
              filtro: { anio, tipo: 'alquiler', estado: 'firmado' },
            })
          }
        />
      </div>

      {drill && (
        <DetalleDrillModal
          titulo={drill.titulo}
          subtitulo={drill.subtitulo}
          filtro={drill.filtro}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}
