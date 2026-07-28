import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeVerTodo } from '../../../lib/rbac';
import { listCaptadas } from '../../../lib/protocolo-api';
import { ToggleVerTodo } from '../../../components/tablero/toggle-ver-todo';
import { CaptadasLista } from '../../../components/protocolo/captadas-lista';

export default async function CaptadasPage({
  searchParams,
}: {
  searchParams: Promise<{ verTodo?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const verTodo = (await searchParams).verTodo === '1';
  const captadas = await listCaptadas(ctx.accessToken, verTodo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Captadas sin iniciar</h2>
          <p className="text-xs text-muted">
            Tasaciones en estado Captada que todavía no arrancaron su comercialización.
          </p>
        </div>
        {puedeVerTodo(ctx.principal.roles) && <ToggleVerTodo />}
      </div>

      <CaptadasLista captadas={captadas} />
    </div>
  );
}
