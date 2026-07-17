import { getEvolucionAnual, getKpisResumen, getObjetivosSeguimiento } from '../../lib/tablero-api';
import { requireServerPrincipal } from '../../lib/server-principal';
import { fmtNum, fmtUSD } from '../../lib/format';
import { FiltroPeriodo } from '../../components/tablero/filtro-periodo';
import { KpiCard } from '../../components/tablero/kpi-card';
import { EvolucionVentasChart } from '../../components/tablero/evolucion-ventas-chart';
import { ResumenAcumulado } from '../../components/tablero/resumen-acumulado';
import { RankingTable } from '../../components/tablero/ranking-table';
import { ObjetivosTable } from '../../components/tablero/objetivos-table';
import type { AgregadoKpi } from '@vacker/types';

function kpiCards(agg: AgregadoKpi) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard label="Volumen" value={fmtUSD(agg.volumen)} icon="💰" tone="brand" />
      <KpiCard
        label="Operaciones"
        value={fmtNum(agg.operaciones)}
        sub={`${fmtNum(agg.puntas)} puntas`}
        icon="🏠"
      />
      <KpiCard label="Ticket prom." value={fmtUSD(agg.ticketPromedio)} icon="🎯" />
      <KpiCard label="Puntas compradoras" value={fmtNum(agg.puntasCompradoras)} icon="🤝" />
      <KpiCard label="Puntas vendedoras" value={fmtNum(agg.puntasVendedoras)} icon="🧑‍💼" />
      <KpiCard label="Comisión" value={fmtUSD(agg.comision)} icon="💵" tone="success" />
    </div>
  );
}

export default async function TableroDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const hoy = new Date();
  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : hoy.getFullYear();
  // El mes siempre está seleccionado (como el prototipo): "año completo" se
  // elige con el tab "Acumulado Anual" del Resumen, no con "todos los meses".
  const mes = params.mes ? Number(params.mes) : hoy.getMonth() + 1;

  const [resumen, objetivos, evolucion] = await Promise.all([
    getKpisResumen(ctx.accessToken, { anio, mes }),
    getObjetivosSeguimiento(ctx.accessToken, { anio, mes }),
    getEvolucionAnual(ctx.accessToken, anio),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Dashboard</h2>
        <FiltroPeriodo anio={anio} mes={mes} />
      </div>

      {resumen.mesActual && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Mes seleccionado</p>
          {kpiCards(resumen.mesActual)}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Acumulado año {anio}</p>
        {kpiCards(resumen.anual)}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard
          label="Pendiente de cobro"
          value={fmtUSD(resumen.pendienteCobro)}
          sub={`${fmtNum(resumen.operacionesSenadas)} operaciones señadas`}
          icon="⏳"
          tone="warning"
        />
        <KpiCard
          label={`Alquileres firmados · ${anio}`}
          value={fmtNum(resumen.alquileres.firmados)}
          sub={`${fmtUSD(resumen.alquileres.comision)} comisión · ${fmtUSD(resumen.alquileres.valorMensualPromedio)} prom./mes`}
          icon="🔑"
        />
      </div>

      <ObjetivosTable items={objetivos} />

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">📊 Resumen acumulado</p>
        <ResumenAcumulado anio={anio} mesSeleccionado={mes} />
      </section>

      <EvolucionVentasChart anio={anio} datos={evolucion} />

      <RankingTable anio={anio} mesSeleccionado={mes} />
    </div>
  );
}
