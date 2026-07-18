import { getKpisResumen } from '../../lib/tablero-api';
import { requireServerPrincipal } from '../../lib/server-principal';
import { FiltroPeriodo } from '../../components/tablero/filtro-periodo';
import { DashboardKpis } from '../../components/tablero/dashboard-kpis';
import { ResumenAcumulado } from '../../components/tablero/resumen-acumulado';
import { RankingTable } from '../../components/tablero/ranking-table';

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

  const resumen = await getKpisResumen(ctx.accessToken, { anio, mes });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Dashboard</h2>
        <FiltroPeriodo anio={anio} mes={mes} />
      </div>

      <DashboardKpis resumen={resumen} anio={anio} mes={mes} />

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">📊 Resumen acumulado</p>
        <ResumenAcumulado anio={anio} mesSeleccionado={mes} />
      </section>

      <RankingTable anio={anio} mesSeleccionado={mes} />
    </div>
  );
}
