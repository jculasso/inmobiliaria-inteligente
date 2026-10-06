import { sesionServidor } from '../../lib/server-principal';
import {
  getDashboardTasador,
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
  const s = await sesionServidor();
  if (!s) return null;

  const anio = new Date().getFullYear();
  const verTodo = (await searchParams).verTodo === '1';
  // Se resuelven server-side y en paralelo (mismo criterio que app/tablero/page.tsx):
  // el dashboard llega con datos, sin "Cargando…" ni la cascada getAccessToken→4 fetches
  // client-side sobre el hop lento hacia Supabase. El perfil viaja en el mismo
  // lote: el rol solo decide qué se muestra, no qué se pide.
  const [principal, dashboard, tasaciones] = await Promise.all([
    s.principal,
    // Resumen, ranking y los doce meses en un solo pedido (antes eran tres).
    getDashboardTasador(s.accessToken, anio, verTodo),
    listTasacionesResumen(s.accessToken, { anio, verTodo }),
  ]);
  // Si la API todavía no tiene el pedido nuevo, como antes.
  const [kpisMensual, resumenAnual, rankingAnual] = dashboard
    ? [dashboard.mensual, dashboard.resumen, dashboard.ranking]
    : await Promise.all([
        getKpisMensualTasador(s.accessToken, anio, verTodo),
        getKpisResumenTasador(s.accessToken, { anio, periodo: 'anual', verTodo }),
        getRankingCaptaciones(s.accessToken, { anio, periodo: 'anual', verTodo }),
      ]);
  if (!principal) return null;

  return (
    // key por verTodo: al togglear, el componente re-monta con el `inicial`
    // nuevo (ya scopeado), en vez de conservar el estado con datos viejos.
    <TasadorDashboard
      key={verTodo ? 'todo' : 'mio'}
      principal={principal}
      inicial={{ kpisMensual, resumenAnual, rankingAnual, tasaciones }}
      verTodo={verTodo}
    />
  );
}
