import Link from 'next/link';
import {
  ESTADO_SEMANA_LABEL,
  textoDeCierre,
  type AlertaProtocolo,
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
//
// Los textos están escritos para un CEO que entra una vez por semana: cada
// línea tiene que decir qué pasa y qué hacer, sin vocabulario de sistema.

/**
 * Color de cada semana en la tira de cinco.
 *
 * `danger` y no `brand-red`: el color de marca lo pisa cada inmobiliaria, y en
 * una con marca azul la semana incompleta salía azul — indistinguible de un
 * dato informativo. La urgencia no es de la marca.
 */
const CLASE_SEMANA: Record<EstadoSemana, string> = {
  completa: 'bg-success/15 text-success border-success/30',
  en_curso: 'bg-warning/15 text-warning border-warning/40',
  incompleta: 'bg-danger/10 text-danger border-danger/40',
  futura: 'bg-surface text-muted border-line',
};

/** A dónde lleva una alerta: a la semana donde está el problema. */
function linkDeAlerta(protocoloId: string, alerta: AlertaProtocolo): string {
  return alerta.semana != null
    ? `/protocolo/${protocoloId}?semana=${alerta.semana}`
    : `/protocolo/${protocoloId}`;
}

/**
 * Las cinco semanas de un vistazo, y cada una es un link a esa semana de la
 * ficha. Es la vista que pidió la dirección: en qué semana del proceso está
 * cada cosa, y llegar de un click.
 */
function TiraDeSemanas({ propiedad }: { propiedad: PropiedadEnReporte }) {
  return (
    <div className="flex gap-1">
      {propiedad.semanas.map((s) => {
        const detalle =
          s.atrasadas > 0
            ? `${s.atrasadas} sin cerrar y vencidas`
            : s.pendientes > 0
              ? `${s.pendientes} por hacer`
              : '';
        return (
          <Link
            key={s.semana}
            href={`/protocolo/${propiedad.protocoloId}?semana=${s.semana}`}
            title={`Semana ${s.semana} · ${ESTADO_SEMANA_LABEL[s.estado]}${detalle ? ` · ${detalle}` : ''}`}
            className={`flex min-w-0 flex-1 flex-col items-center rounded border px-1 py-1 transition-opacity hover:opacity-75 ${CLASE_SEMANA[s.estado]}`}
          >
            <span className="text-[11px] font-bold leading-none">S{s.semana}</span>
            <span className="mt-0.5 text-[11px] font-extrabold leading-none tabular-nums">
              {s.estado === 'futura' ? '·' : s.atrasadas > 0 ? s.atrasadas : s.pendientes || '✓'}
            </span>
          </Link>
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
      <div>
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

      <TiraDeSemanas propiedad={propiedad} />

      {/* El cierre con tareas pendientes se dice completo: el verde solo, al
          lado de una alerta roja, se leía como una contradicción. */}
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
            <Link key={`${propiedad.protocoloId}-${i}`} href={linkDeAlerta(propiedad.protocoloId, a)}>
              <AlertaItem alerta={a} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** "2 propiedades · 1 necesita atención", sin repetirse cuando hay una sola. */
export function resumenDeVendedor(total: number, conRojas: number): string {
  const base = total === 1 ? '1 propiedad' : `${total} propiedades`;
  if (conRojas === 0) return base;
  if (total === 1) return `${base} · necesita atención`;
  return `${base} · ${conRojas === 1 ? '1 necesita atención' : `${conRojas} necesitan atención`}`;
}

function BloqueVendedor({ vendedor }: { vendedor: VendedorEnReporte }) {
  const resumen = resumenDeVendedor(vendedor.propiedades.length, vendedor.conRojas);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
        <h3 className="truncate text-sm font-extrabold text-ink">{vendedor.vendedorNombre}</h3>
        <p
          className={`shrink-0 text-xs ${vendedor.conRojas > 0 ? 'font-semibold text-danger' : 'text-muted'}`}
        >
          {resumen}
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
        <KpiCard
          label="En comercialización"
          value={fmtNum(resumen.activas)}
          sub="Propiedades activas"
          icon="🏠"
          tone="brand"
        />
        <KpiCard
          label="Necesitan atención"
          value={fmtNum(resumen.conRojas)}
          sub="Con algo vencido"
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
              : 'Completaron las cinco semanas'
          }
          icon="🏁"
          tone="success"
        />
      </div>

      {reporte.porVendedor.length === 0 ? (
        <p className="rounded-brand border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          Todavía no hay propiedades en comercialización. Cuando se inicie el primer protocolo, va a
          aparecer acá.
        </p>
      ) : !reporte.hayUrgencias ? (
        // Regla 9: cuando no hay nada vencido, el reporte es corto. Un informe
        // que mide siempre lo mismo se deja de leer en la tercera semana.
        <p className="rounded-brand border border-success/30 bg-success/5 px-4 py-3 text-sm font-semibold text-success">
          ✓ Ninguna propiedad necesita atención esta semana. Todo el trabajo está al día.
        </p>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-danger">
            Necesita atención
          </h2>
          <div className="flex flex-col gap-2">
            {reporte.urgencias.map((item) => (
              <div key={item.protocoloId} className="rounded-brand border border-danger/30 bg-white p-3">
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
                    <Link key={`${item.protocoloId}-r${i}`} href={linkDeAlerta(item.protocoloId, a)}>
                      <AlertaItem alerta={a} />
                    </Link>
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
