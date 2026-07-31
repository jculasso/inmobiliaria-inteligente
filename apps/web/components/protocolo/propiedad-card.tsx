import Link from 'next/link';
import type { ProtocoloResumenDto } from '@vacker/types';
import { MOTIVO_ARCHIVO_LABEL, TOTAL_SEMANAS } from '@vacker/types';
import { fmtUSD } from '../../lib/format';
import { BarraAvance, ETIQUETA_PRIORIDAD, FotoPropiedad, Pill, porcentaje } from './protocolo-ui';

/** Nivel más urgente de las alertas — define el chip de la esquina. */
function prioridad(p: ProtocoloResumenDto) {
  if (p.alertas.some((a) => a.nivel === 'roja')) return 'roja' as const;
  if (p.alertas.some((a) => a.nivel === 'ambar')) return 'ambar' as const;
  return 'verde' as const;
}

/** Tarjeta de una propiedad en comercialización (grilla del dashboard). */
export function PropiedadCard({ p }: { p: ProtocoloResumenDto }) {
  const nivel = prioridad(p);
  const archivada = p.estado === 'archivada';

  return (
    <article className="flex flex-col overflow-hidden rounded-brand border border-line bg-white shadow-sm">
      <div className="relative">
        <FotoPropiedad url={p.propiedad.fotoUrl} alt={p.propiedad.direccion} />
        <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-extrabold text-white">
          {archivada ? 'Archivada' : `Semana ${p.semanaActual} de ${TOTAL_SEMANAS}`}
        </span>
        {!archivada && (
          <span
            className={`absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold ${
              nivel === 'roja' ? 'text-danger' : nivel === 'ambar' ? 'text-warning' : 'text-success'
            }`}
          >
            {ETIQUETA_PRIORIDAD[nivel]}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div>
          <h3 className="text-base font-bold leading-snug text-ink">{p.propiedad.direccion}</h3>
          <p className="text-xs text-muted">
            {[p.propiedad.barrio, p.propiedad.ciudad].filter(Boolean).join(' · ') || p.propiedad.tipoPropiedad}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">
            {p.precioPublicado != null ? fmtUSD(p.precioPublicado) : 'Precio no informado'}
          </span>
          <span className="font-bold text-ink">{porcentaje(p.avance)}</span>
        </div>
        <BarraAvance valor={p.avance} />

        <div className="flex flex-wrap gap-1.5">
          <Pill>{p.diasPublicada} días</Pill>
          <Pill>{p.agente.nombre}</Pill>
          {archivada && p.motivoArchivo && (
            <Pill tono="neutro">{MOTIVO_ARCHIVO_LABEL[p.motivoArchivo]}</Pill>
          )}
        </div>

        {!archivada && (
          <p className="text-xs text-muted">
            <span className="font-semibold text-ink">Próxima acción: </span>
            {p.proximaAccion ?? 'Protocolo completo'}
          </p>
        )}

        <Link
          href={`/protocolo/${p.id}`}
          className="mt-auto inline-flex items-center justify-center rounded-brand bg-brand-red px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-red-dark"
        >
          Abrir protocolo
        </Link>
      </div>
    </article>
  );
}
