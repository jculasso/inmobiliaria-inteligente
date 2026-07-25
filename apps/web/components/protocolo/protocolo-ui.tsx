import type { AlertaProtocolo, NivelAlerta } from '@vacker/types';

// Piezas visuales compartidas del módulo Protocolo.

const CLASE_NIVEL: Record<NivelAlerta, string> = {
  roja: 'border-brand-red/30 bg-brand-red/5 text-brand-red-dark',
  ambar: 'border-warning/30 bg-warning/5 text-warning',
  verde: 'border-success/30 bg-success/5 text-success',
};

const ICONO_NIVEL: Record<NivelAlerta, string> = {
  roja: '!',
  ambar: '•',
  verde: '✓',
};

export const ETIQUETA_PRIORIDAD: Record<NivelAlerta, string> = {
  roja: 'Atención',
  ambar: 'Revisar',
  verde: 'Al día',
};

/** Alerta de una propiedad, con su color según urgencia. */
export function AlertaItem({ alerta }: { alerta: AlertaProtocolo }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-brand border px-3 py-2 ${CLASE_NIVEL[alerta.nivel]}`}>
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-xs font-extrabold"
      >
        {ICONO_NIVEL[alerta.nivel]}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-snug">{alerta.titulo}</span>
        <span className="block text-xs leading-snug opacity-80">{alerta.detalle}</span>
      </span>
    </div>
  );
}

/** Barra de avance del protocolo (0..1). */
export function BarraAvance({ valor }: { valor: number }) {
  const pct = Math.round(valor * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] ${pct === 100 ? 'bg-success' : 'bg-brand-red'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Chip de estado/dato, con tono opcional. */
export function Pill({
  children,
  tono = 'neutro',
}: {
  children: React.ReactNode;
  tono?: 'neutro' | 'rojo' | 'verde' | 'ambar';
}) {
  const clases = {
    neutro: 'bg-surface text-muted',
    rojo: 'bg-brand-red/10 text-brand-red-dark',
    verde: 'bg-success/10 text-success',
    ambar: 'bg-warning/10 text-warning',
  }[tono];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${clases}`}>
      {children}
    </span>
  );
}

/** Portada de la propiedad; si no hay foto muestra un marcador sobrio. */
export function FotoPropiedad({
  url,
  alt,
  className = 'h-36 w-full',
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-surface text-xs text-muted ${className}`}>
        Sin fotografía
      </div>
    );
  }
  // <img> y no next/image: la URL es firmada por Supabase y expira, así que el
  // optimizador de Next no aporta (mismo criterio que fotos-uploader).
  return <img src={url} alt={alt} className={`object-cover ${className}`} />;
}

export function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}
