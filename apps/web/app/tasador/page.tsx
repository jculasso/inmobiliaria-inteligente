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
  searchParams: Promise<{ soloMio?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const anio = new Date().getFullYear();
  const soloMio = (await searchParams).soloMio === '1';
  // Se resuelven server-side y en paralelo (mismo criterio que app/tablero/page.tsx):
  // el dashboard llega con datos, sin "Cargando…" ni la cascada getAccessToken→4 fetches
  // client-side sobre el hop lento hacia Supabase.
  const [kpisMensual, resumenAnual, rankingAnual, tasaciones] = await Promise.all([
    getKpisMensualTasador(ctx.accessToken, anio, soloMio),
    getKpisResumenTasador(ctx.accessToken, { anio, periodo: 'anual', soloMio }),
    getRankingCaptaciones(ctx.accessToken, { anio, periodo: 'anual', soloMio }),
    listTasacionesResumen(ctx.accessToken, { anio, soloMio }),
  ]);

  return (
    // key por soloMio: al togglear, el componente re-monta con el `inicial`
    // nuevo (ya scopeado), en vez de conservar el estado con datos viejos.
    <TasadorDashboard
      key={soloMio ? 'mio' : 'todo'}
      principal={ctx.principal}
      inicial={{ kpisMensual, resumenAnual, rankingAnual, tasaciones }}
      soloMio={soloMio}
    />
  );
}
