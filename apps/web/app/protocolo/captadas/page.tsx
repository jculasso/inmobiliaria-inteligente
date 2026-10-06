import { sesionServidor } from '../../../lib/server-principal';
import { puedeVerTodo } from '../../../lib/rbac';
import { listCaptadas } from '../../../lib/protocolo-api';
import { ToggleVerTodo } from '../../../components/tablero/toggle-ver-todo';
import { CaptadasLista } from '../../../components/protocolo/captadas-lista';
import { EncabezadoPagina } from '../../../components/piezas';

export default async function CaptadasPage({
  searchParams,
}: {
  searchParams: Promise<{ verTodo?: string }>;
}) {
  const s = await sesionServidor();
  if (!s) return null;

  const verTodo = (await searchParams).verTodo === '1';
  const [principal, captadas] = await Promise.all([
    s.principal,
    listCaptadas(s.accessToken, verTodo),
  ]);
  if (!principal) return null;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Captadas sin iniciar"
        detalle={
          <p className="text-xs text-muted">
            Tasaciones en estado Captada que todavía no arrancaron su comercialización.
          </p>
        }
      >
        {puedeVerTodo(principal.roles) && <ToggleVerTodo />}
      </EncabezadoPagina>

      <CaptadasLista captadas={captadas} />
    </div>
  );
}
