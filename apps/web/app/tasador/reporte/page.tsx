import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeVerTodo } from '../../../lib/rbac';
import { ReporteView } from '../../../components/tasador/reporte-view';

export default async function TasadorReportePage({
  searchParams,
}: {
  searchParams: Promise<{ verTodo?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const params = await searchParams;

  const anioInicial = new Date().getFullYear();
  return (
    <ReporteView
      anioInicial={anioInicial}
      verTodo={params.verTodo === '1'}
      puedeVerTodo={puedeVerTodo(ctx.principal.roles)}
    />
  );
}
