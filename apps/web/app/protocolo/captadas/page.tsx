import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeVerSoloLoMio } from '../../../lib/rbac';
import { listCaptadas } from '../../../lib/protocolo-api';
import { ToggleSoloMio } from '../../../components/tablero/toggle-solo-mio';
import { CaptadasLista } from '../../../components/protocolo/captadas-lista';

export default async function CaptadasPage({
  searchParams,
}: {
  searchParams: Promise<{ soloMio?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const soloMio = (await searchParams).soloMio === '1';
  const captadas = await listCaptadas(ctx.accessToken, soloMio);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Captadas sin iniciar</h2>
          <p className="text-xs text-muted">
            Tasaciones en estado Captada que todavía no arrancaron su comercialización.
          </p>
        </div>
        {puedeVerSoloLoMio(ctx.principal.roles) && <ToggleSoloMio />}
      </div>

      <CaptadasLista captadas={captadas} />
    </div>
  );
}
