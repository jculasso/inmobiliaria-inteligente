import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeReabrirProtocolo, puedeVerSoloLoMio } from '../../../lib/rbac';
import { listCaptadas, listProtocolos } from '../../../lib/protocolo-api';
import { ToggleSoloMio } from '../../../components/tablero/toggle-solo-mio';
import { ReporteGeneral } from '../../../components/protocolo/reporte-general';

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ soloMio?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const soloMio = (await searchParams).soloMio === '1';
  const [captadas, activas, archivadas] = await Promise.all([
    listCaptadas(ctx.accessToken, soloMio),
    listProtocolos(ctx.accessToken, { estado: 'activa', soloMio }),
    listProtocolos(ctx.accessToken, { estado: 'archivada', soloMio }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Propiedades</h2>
          <p className="text-xs text-muted">
            Todo el ciclo: captadas sin iniciar, en comercialización y archivadas.
          </p>
        </div>
        {puedeVerSoloLoMio(ctx.principal.roles) && <ToggleSoloMio />}
      </div>

      <ReporteGeneral
        captadas={captadas}
        activas={activas}
        archivadas={archivadas}
        puedeReabrir={puedeReabrirProtocolo(ctx.principal.roles)}
      />
    </div>
  );
}
