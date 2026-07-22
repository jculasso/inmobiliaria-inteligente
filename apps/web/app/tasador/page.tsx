import { requireServerPrincipal } from '../../lib/server-principal';
import {
  getKpisMensualTasador,
  getKpisResumenTasador,
  getRankingCaptaciones,
  listTasacionesResumen,
} from '../../lib/tasador-api';
import { TasadorDashboard } from '../../components/tasador/tasador-dashboard';

export default async function TasadorDashboardPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const anio = new Date().getFullYear();
  // Se resuelven server-side y en paralelo (mismo criterio que app/tablero/page.tsx):
  // el dashboard llega con datos, sin "Cargando…" ni la cascada getAccessToken→4 fetches
  // client-side sobre el hop lento hacia Supabase.
  const [kpisMensual, resumenAnual, rankingAnual, tasaciones] = await Promise.all([
    getKpisMensualTasador(ctx.accessToken, anio),
    getKpisResumenTasador(ctx.accessToken, { anio, periodo: 'anual' }),
    getRankingCaptaciones(ctx.accessToken, { anio, periodo: 'anual' }),
    listTasacionesResumen(ctx.accessToken, { anio }),
  ]);

  return (
    <TasadorDashboard
      principal={ctx.principal}
      inicial={{ kpisMensual, resumenAnual, rankingAnual, tasaciones }}
    />
  );
}
