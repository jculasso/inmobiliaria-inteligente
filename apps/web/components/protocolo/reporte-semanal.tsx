import Link from 'next/link';
import {
  ESTADO_SEMANA_LABEL,
  textoDeCierre,
  type EstadoSemana,
  type PropiedadEnReporte,
  type ReporteSemanal,
  type VendedorEnReporte,
} from '@vacker/types';
import { KpiCard } from '@vacker/ui';
import { fmtNum } from '../../lib/format';
import { AlertaItem, ETIQUETA_PRIORIDAD } from './protocolo-ui';

// Reporte semanal en pantalla. Es EL MISMO objeto que va a viajar en el mail,
// así que lo que se ve acá es lo que va a leer la dirección el lunes: si esta
// pantalla se entiende, el mail también.

/** Color de cada semana en la tira de cinco. */
const CLASE_SEMANA: Record<EstadoSemana, string> = {
  completa: 'bg-success/15 text-success border-success/30',
  en_curso: 'bg-warning/15 text-warning border-warning/40',
  incompleta: 'bg-brand-red/10 text-brand-red border-brand-red/30',
  futura: 'bg-bg text-muted border-line',
};

/**
 * Las cinco semanas de un vistazo. Es la vista que pidió la dirección: qué
 * alertas tiene la propiedad en cada semana del proceso.
 */
function TiraDeSemanas({ propiedad }: { propiedad: PropiedadEnReporte }) {
  return (
    <div className="flex gap-1">
      {propiedad.semanas.map((s) => {
        const detalle = s.atrasadas > 0 ? `${s.atrasadas} atrasadas` : `${s.pendientes} pendientes`;
        return (
          <div
            key={s.semana}
            title={`Semana ${s.semana} · ${ESTADO_SEMANA_LABEL[s.estado]}${
              s.pendientes > 0 ? ` · ${detalle}` : ''
            }`}
            className={`flex min-w-0 flex-1 flex-col items-center rounded border px-1 py-1 ${CLASE_SEMANA[s.estado]}`}
          >
            <span className="text-[11px] font-bold leading-none">S{s.semana}</span>
            <span className="mt-0.5 text-[11px] font-extrabold leading-none tabular-nums">
              {s.estado === 'futura' ? '·' : s.atrasadas > 0 ? s.atrasadas : s.pendientes || '✓'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FichaPropiedad({ propiedad }: { propiedad: PropiedadEnReporte }) {
  const cierre = textoDeCierre(propiedad);
  const alertas = [...propiedad.alertasGenerales, ...propiedad.semanas.flatMap((s) => s.alertas)];

  return (
    <div className="flex flex-col gap-2 rounded-brand border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/protocolo/${propiedad.protocoloId}`}
            className="block truncate text-sm font-bold text-ink hover:text-brand-red hover:underline"
          >
            {propiedad.direccion}
          </Link>
          <p className="text-xs text-muted">
            Semana {propiedad.semanaActual} de 5 · {ETIQUETA_PRIORIDAD[propiedad.prioridad]}
          </p>
        </div>
      </div>

      <TiraDeSemanas propiedad={propiedad} />

      {/* El cierre con tareas pendientes se dice completo: el verde solo, al
          lado de una alerta roja, parecía una contradicción. */}
      {cierre && (
        <p
          className={`text-xs font-semibold ${
            propiedad.pendientesArrastrados > 0 ? 'text-warning' : 'text-success'
          }`}
        >
          {cierre}
        </p>
      )}

      {alertas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {alertas.map((a, i) => (
            <AlertaItem key={`${propiedad.protocoloId}-${i}`} alerta={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function BloqueVendedor({ vendedor }: { vendedor: VendedorEnReporte }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
        <h3 className="truncate text-sm font-extrabold text-ink">{vendedor.vendedorNombre}</h3>
        <p className="shrink-0 text-xs text-muted">
          {vendedor.propiedades.length}{' '}
          {vendedor.propiedades.length === 1 ? 'propiedad' : 'propiedades'}
          {vendedor.conRojas > 0 && (
            <span className="ml-1.5 font-bold text-brand-red">
              · {vendedor.conRojas} con atención
            </span>
          )}
        </p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {vendedor.propiedades.map((p) => (
          <FichaPropiedad key={p.protocoloId} propiedad={p} />
        ))}
      </div>
    </section>
  );
}

export function ReporteSemanalVista({ reporte }: { reporte: ReporteSemanal }) {
  const { resumen } = reporte;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="En comercialización" value={fmtNum(resumen.activas)} icon="🏠" tone="brand" />
        <KpiCard
          label="Necesitan decisión"
          value={fmtNum(resumen.conRojas)}
          sub="Con alerta urgente"
          icon="🔴"
          tone={resumen.conRojas > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Autorizaciones"
          value={fmtNum(resumen.autorizacionesEnRiesgo)}
          sub="Vencidas o por vencer"
          icon="📄"
          tone={resumen.autorizacionesEnRiesgo > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Listas para cierre"
          value={fmtNum(resumen.listasParaCierre)}
          sub={
            resumen.listasConPendientes > 0
              ? `${resumen.listasConPendientes} con tareas pendientes`
              : 'Sin tareas pendientes'
          }
          icon="🏁"
          tone="success"
        />
      </div>

      {reporte.porVendedor.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          No hay propiedades en comercialización. Cuando se inicie el primer protocolo, va a
          aparecer acá.
        </p>
      ) : !reporte.necesitaAtencion ? (
        // Regla 9: cuando no hay nada rojo, el reporte es corto. Un mail que
        // mide siempre lo mismo se ignora en la tercera semana.
        <p className="rounded-brand border border-success/30 bg-success/5 px-4 py-3 text-sm font-semibold text-success">
          ✓ Nada urgente esta semana. Ninguna propiedad tiene alertas que necesiten una decisión.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-brand-red">
            Necesita decisión
          </h2>
          <div className="flex flex-col gap-2">
            {reporte.necesitaDecision.map((item) => (
              <div
                key={item.protocoloId}
                className="rounded-brand border border-brand-red/30 bg-white p-3"
              >
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={`/protocolo/${item.protocoloId}`}
                    className="text-sm font-bold text-ink hover:text-brand-red hover:underline"
                  >
                    {item.direccion}
                  </Link>
                  <span className="text-xs text-muted">· {item.vendedorNombre}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {item.alertas.map((a, i) => (
                    <AlertaItem key={`${item.protocoloId}-r${i}`} alerta={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reporte.porVendedor.length > 0 && (
        <div className="flex flex-col gap-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">
            Detalle por vendedor
          </h2>
          {reporte.porVendedor.map((v) => (
            <BloqueVendedor key={v.vendedorId} vendedor={v} />
          ))}
        </div>
      )}
    </div>
  );
}
