import { getKpisResumen, getResumenRango } from '../../lib/tablero-api';
import { requireServerPrincipal } from '../../lib/server-principal';
import { puedeVerTodo } from '../../lib/rbac';
import { FiltroPeriodo } from '../../components/tablero/filtro-periodo';
import { ToggleVerTodo } from '../../components/tablero/toggle-ver-todo';
import { DashboardKpis } from '../../components/tablero/dashboard-kpis';
import { ResumenAcumulado } from '../../components/tablero/resumen-acumulado';
import { RankingTable } from '../../components/tablero/ranking-table';

export default async function TableroDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; verTodo?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const hoy = new Date();
  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : hoy.getFullYear();
  // El mes siempre está seleccionado (como el prototipo): "año completo" se
  // elige con el tab "Acumulado Anual" del Resumen, no con "todos los meses".
  const mes = params.mes ? Number(params.mes) : hoy.getMonth() + 1;
  const verTodo = params.verTodo === '1';

  // Se piden en paralelo: el resumen del mes seleccionado (KPIs de arriba) y
  // el acumulado anual (año completo), que es el tab por defecto de
  // ResumenAcumulado/RankingTable — evita que esos componentes lo vuelvan a
  // pedir al montar con los valores por defecto (mismo dato, un round-trip
  // menos en el hop más lento del stack).
  const [resumen, resumenAnual] = await Promise.all([
    getKpisResumen(ctx.accessToken, { anio, mes, verTodo }),
    getResumenRango(ctx.accessToken, anio, 1, 12, verTodo),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Dashboard</h2>
        <div className="flex flex-wrap items-center gap-3">
          {puedeVerTodo(ctx.principal.roles) && <ToggleVerTodo />}
          <FiltroPeriodo anio={anio} mes={mes} />
        </div>
      </div>

      <DashboardKpis resumen={resumen} anio={anio} mes={mes} verTodo={verTodo} />

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">📊 Resumen acumulado</p>
        <ResumenAcumulado anio={anio} mesSeleccionado={mes} verTodo={verTodo} inicial={resumenAnual} />
      </section>

      <RankingTable anio={anio} mesSeleccionado={mes} verTodo={verTodo} inicial={resumenAnual} />
    </div>
  );
}
