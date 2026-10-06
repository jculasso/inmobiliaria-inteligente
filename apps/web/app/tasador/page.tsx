import { sesionServidor } from '../../lib/server-principal';
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
  const s = await sesionServidor();
  if (!s) return null;

  const anio = new Date().getFullYear();
  const verTodo = (await searchParams).verTodo === '1';
  // Se resuelven server-side y en paralelo (mismo criterio que app/tablero/page.tsx):
  // el dashboard llega con datos, sin "Cargando…" ni la cascada getAccessToken→4 fetches
  // client-side sobre el hop lento hacia Supabase. El perfil viaja en el mismo
  // lote: el rol solo decide qué se muestra, no qué se pide.
  const [principal, kpisMensual, resumenAnual, rankingAnual, tasaciones] = await Promise.all([
    s.principal,
    getKpisMensualTasador(s.accessToken, anio, verTodo),
    getKpisResumenTasador(s.accessToken, { anio, periodo: 'anual', verTodo }),
    getRankingCaptaciones(s.accessToken, { anio, periodo: 'anual', verTodo }),
    listTasacionesResumen(s.accessToken, { anio, verTodo }),
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
