import { requireServerPrincipal } from '../../lib/server-principal';
import {
  getKpisMensualTasador,
  getKpisResumenTasador,
  getRankingCaptaciones,
  listTasacionesResumen,
} from '../../lib/tasador-api';
import { TasadorDashboard } from '../../components/tasador/tasador-dashboard';

export default async function TasadorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verTodo?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const anio = new Date().getFullYear();
  const verTodo = (await searchParams).verTodo === '1';
  // Se resuelven server-side y en paralelo (mismo criterio que app/tablero/page.tsx):
  // el dashboard llega con datos, sin "Cargando…" ni la cascada getAccessToken→4 fetches
  // client-side sobre el hop lento hacia Supabase.
  const [kpisMensual, resumenAnual, rankingAnual, tasaciones] = await Promise.all([
    getKpisMensualTasador(ctx.accessToken, anio, verTodo),
    getKpisResumenTasador(ctx.accessToken, { anio, periodo: 'anual', verTodo }),
    getRankingCaptaciones(ctx.accessToken, { anio, periodo: 'anual', verTodo }),
    listTasacionesResumen(ctx.accessToken, { anio, verTodo }),
  ]);

  return (
    // key por verTodo: al togglear, el componente re-monta con el `inicial`
    // nuevo (ya scopeado), en vez de conservar el estado con datos viejos.
    <TasadorDashboard
      key={verTodo ? 'todo' : 'mio'}
      principal={ctx.principal}
      inicial={{ kpisMensual, resumenAnual, rankingAnual, tasaciones }}
      verTodo={verTodo}
    />
  );
}
