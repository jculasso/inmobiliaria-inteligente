import { requireServerPrincipal } from '../../../lib/server-principal';
import { puedeReabrirProtocolo, puedeVerSoloLoMio } from '../../../lib/rbac';
import { listCaptadas, listProtocolos } from '../../../lib/protocolo-api';
import { ToggleSoloMio } from '../../../components/tablero/toggle-solo-mio';
import { FiltroOperaciones } from '../../../components/tablero/filtro-operaciones';
import { ReporteGeneral } from '../../../components/protocolo/reporte-general';

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ soloMio?: string; anio?: string; mes?: string; trimestre?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const params = await searchParams;
  const soloMio = params.soloMio === '1';
  // Mismo control de período que Ventas. Sin `anio` = todos los años, para no
  // esconder propiedades que arrancaron el año pasado y siguen activas.
  const periodo = {
    anio: params.anio ? Number(params.anio) : undefined,
    mes: params.mes ? Number(params.mes) : undefined,
    trimestre: params.trimestre ? Number(params.trimestre) : undefined,
  };

  const [captadas, activas, archivadas] = await Promise.all([
    listCaptadas(ctx.accessToken, soloMio),
    listProtocolos(ctx.accessToken, { ...periodo, estado: 'activa', soloMio }),
    listProtocolos(ctx.accessToken, { ...periodo, estado: 'archivada', soloMio }),
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
        <div className="flex flex-wrap items-center gap-3">
          {puedeVerSoloLoMio(ctx.principal.roles) && <ToggleSoloMio />}
          <FiltroOperaciones anio={periodo.anio} mes={periodo.mes} trimestre={periodo.trimestre} />
        </div>
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
