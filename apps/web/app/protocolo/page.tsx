import Link from 'next/link';
import { KpiCard } from '@vacker/ui';
import { requireServerPrincipal } from '../../lib/server-principal';
import { puedeVerSoloLoMio } from '../../lib/rbac';
import { fmtNum } from '../../lib/format';
import { getProtocoloKpis, listProtocolos } from '../../lib/protocolo-api';
import { ToggleSoloMio } from '../../components/tablero/toggle-solo-mio';
import { PropiedadCard } from '../../components/protocolo/propiedad-card';
import { AlertaItem, porcentaje } from '../../components/protocolo/protocolo-ui';

export default async function ProtocoloDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ soloMio?: string }>;
}) {
  const ctx = await requireServerPrincipal();
  if (!ctx) return null;

  const soloMio = (await searchParams).soloMio === '1';
  const [kpis, activas] = await Promise.all([
    getProtocoloKpis(ctx.accessToken, soloMio),
    listProtocolos(ctx.accessToken, { estado: 'activa', soloMio }),
  ]);

  // Las alertas se muestran juntas y ordenadas por urgencia: es la pantalla
  // desde la que se decide qué atender primero.
  const alertas = activas
    .flatMap((p) => p.alertas.map((a) => ({ ...a, propiedad: p })))
    .sort((a, b) => nivelOrden(a.nivel) - nivelOrden(b.nivel))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Panel de comercialización</h2>
        {puedeVerSoloLoMio(ctx.principal.roles) && <ToggleSoloMio />}
      </div>

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

      <section className="flex flex-col gap-2 rounded-brand border border-line bg-white p-4">
        <div>
          <h3 className="text-sm font-bold text-ink">Alertas y próximos pasos</h3>
          <p className="text-xs text-muted">Prioridades calculadas según fechas y acciones pendientes.</p>
        </div>
        <div className="flex flex-col gap-2">
          {alertas.length === 0 ? (
            <AlertaItem
              alerta={{
                nivel: 'verde',
                titulo: 'Todo al día',
                detalle: 'No hay alertas pendientes en las propiedades activas.',
              }}
            />
          ) : (
            alertas.map((a, i) => (
              <Link key={`${a.propiedad.id}-${i}`} href={`/protocolo/${a.propiedad.id}`}>
                <AlertaItem
                  alerta={{ ...a, titulo: `${a.propiedad.propiedad.direccion} · ${a.titulo}` }}
                />
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Propiedades en comercialización</h3>
          <Link href="/protocolo/captadas" className="text-sm font-semibold text-brand-red hover:underline">
            Ver captadas sin iniciar →
          </Link>
        </div>

        {activas.length === 0 ? (
          <div className="rounded-brand border border-dashed border-line bg-white px-6 py-12 text-center">
            <p className="text-3xl" aria-hidden>
              🏠
            </p>
            <h4 className="mt-2 text-base font-bold text-ink">Todavía no hay propiedades en comercialización</h4>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Iniciá el protocolo desde una tasación captada para empezar el seguimiento de las 5 semanas.
            </p>
            <Link
              href="/protocolo/captadas"
              className="mt-4 inline-flex items-center justify-center rounded-brand bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
            >
              Ver captadas
            </Link>
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
