import { requireServerPrincipal } from '../../lib/server-principal';
import { TasadorDashboard } from '../../components/tasador/tasador-dashboard';

export default async function TasadorDashboardPage() {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const anioInicial = new Date().getFullYear();
  return <TasadorDashboard anioInicial={anioInicial} />;
}
