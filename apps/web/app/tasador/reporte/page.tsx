import { requireServerPrincipal } from '../../../lib/server-principal';
import { ReporteView } from '../../../components/tasador/reporte-view';

export default async function TasadorReportePage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const anioInicial = new Date().getFullYear();
  return <ReporteView anioInicial={anioInicial} />;
}
