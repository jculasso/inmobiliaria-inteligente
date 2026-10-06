import { sesionServidor } from '../../../lib/server-principal';
import { puedeReabrirProtocolo, puedeVerTodo } from '../../../lib/rbac';
import { listCaptadas, listProtocolos } from '../../../lib/protocolo-api';
import { ToggleVerTodo } from '../../../components/tablero/toggle-ver-todo';
import { FiltroOperaciones } from '../../../components/tablero/filtro-operaciones';
import { ReporteGeneral } from '../../../components/protocolo/reporte-general';
import { EncabezadoPagina } from '../../../components/piezas';

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<{ verTodo?: string; anio?: string; mes?: string; trimestre?: string }>;
}) {
  const s = await sesionServidor();
  if (!s) return null;

  const params = await searchParams;
  const verTodo = params.verTodo === '1';
  // Mismo control de período que Ventas. Sin `anio` = todos los años, para no
  // esconder propiedades que arrancaron el año pasado y siguen activas.
  const periodo = {
    anio: params.anio ? Number(params.anio) : undefined,
    mes: params.mes ? Number(params.mes) : undefined,
    trimestre: params.trimestre ? Number(params.trimestre) : undefined,
  };

  const [principal, captadas, activas, archivadas] = await Promise.all([
    s.principal,
    listCaptadas(s.accessToken, verTodo),
    listProtocolos(s.accessToken, { ...periodo, estado: 'activa', verTodo }),
    listProtocolos(s.accessToken, { ...periodo, estado: 'archivada', verTodo }),
  ]);
  if (!principal) return null;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Propiedades"
        detalle={
          <p className="text-xs text-muted">
            Todo el ciclo: captadas sin iniciar, en comercialización y archivadas.
          </p>
        }
      >
        {puedeVerTodo(principal.roles) && <ToggleVerTodo />}
        <FiltroOperaciones anio={periodo.anio} mes={periodo.mes} trimestre={periodo.trimestre} />
      </EncabezadoPagina>

      <ReporteGeneral
        captadas={captadas}
        activas={activas}
        archivadas={archivadas}
        puedeReabrir={puedeReabrirProtocolo(principal.roles)}
      />
    </div>
  );
}
