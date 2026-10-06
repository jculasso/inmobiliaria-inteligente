import Link from 'next/link';
import { Button, KpiCard } from '@vacker/ui';
import { sesionServidor } from '../../lib/server-principal';
import { puedeVerTodo } from '../../lib/rbac';
import { fmtNum } from '../../lib/format';
import { getProtocoloKpis, listProtocolos } from '../../lib/protocolo-api';
import { ToggleVerTodo } from '../../components/tablero/toggle-ver-todo';
import { PropiedadCard } from '../../components/protocolo/propiedad-card';
import { porcentaje } from '../../components/protocolo/protocolo-ui';
import { PanelAlertas } from '../../components/protocolo/panel-alertas';
import { CLASE_FOCO, EncabezadoPagina, TituloSeccion } from '../../components/piezas';

export default async function ProtocoloDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verTodo?: string }>;
}) {
  const s = await sesionServidor();
  if (!s) return null;

  // El perfil, en paralelo con los datos: el rol solo decide si se muestra el
  // check de «ver todo», no qué se pide.
  const verTodo = (await searchParams).verTodo === '1';
  const [principal, kpis, activas] = await Promise.all([
    s.principal,
    getProtocoloKpis(s.accessToken, verTodo),
    listProtocolos(s.accessToken, { estado: 'activa', verTodo }),
  ]);
  if (!principal) return null;

  // Las alertas se muestran juntas y ordenadas por urgencia: es la pantalla
  // desde la que se decide qué atender primero.
  const alertas = activas
    .flatMap((p) =>
      p.alertas.map((a) => ({ ...a, protocoloId: p.id, direccion: p.propiedad.direccion })),
    )
    .sort((a, b) => nivelOrden(a.nivel) - nivelOrden(b.nivel));

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Panel de comercialización">
        {puedeVerTodo(principal.roles) && <ToggleVerTodo />}
      </EncabezadoPagina>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="En comercialización" value={fmtNum(kpis.activas)} icon="🏠" tone="brand" />
        <KpiCard
          label="Alertas críticas"
          value={fmtNum(kpis.alertasCriticas)}
          sub="Propiedades con atrasos"
          icon="⚠️"
          tone={kpis.alertasCriticas > 0 ? 'warning' : 'default'}
        />
        <KpiCard label="Avance promedio" value={porcentaje(kpis.avancePromedio)} icon="📈" />
        <KpiCard
          label="Captadas sin iniciar"
          value={fmtNum(kpis.captadasSinIniciar)}
          sub="Listas para arrancar"
          icon="📋"
        />
      </div>

      <PanelAlertas alertas={alertas} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TituloSeccion icono="🏠">Propiedades en comercialización</TituloSeccion>
          <Link
            href="/protocolo/captadas"
            className={`rounded text-sm font-semibold text-brand-red hover:underline ${CLASE_FOCO}`}
          >
            Ver captadas sin iniciar →
          </Link>
        </div>

        {activas.length === 0 ? (
          <div className="rounded-brand border border-dashed border-line bg-white px-6 py-12 text-center">
            <p className="text-3xl" aria-hidden>
              🏠
            </p>
            <h4 className="mt-2 text-base font-bold text-ink">
              Todavía no hay propiedades en comercialización
            </h4>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Iniciá el protocolo desde una tasación captada para empezar el seguimiento de las 5
              semanas.
            </p>
            <Button asChild variant="primary" className="mt-4">
              <Link href="/protocolo/captadas">Ver captadas</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((p) => (
              <PropiedadCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function nivelOrden(nivel: 'roja' | 'ambar' | 'verde'): number {
  return nivel === 'roja' ? 0 : nivel === 'ambar' ? 1 : 2;
}
