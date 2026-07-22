import type { NivelConfianza } from '@vacker/domain';

// Semáforo: Alta = verde, Media = ámbar, Baja = rojo. Es la señal clave de la valuación.
const ESTILO: Record<NivelConfianza, string> = {
  Alta: 'bg-success/15 text-success',
  Media: 'bg-warning/15 text-warning',
  Baja: 'bg-brand-red/15 text-brand-red',
};

export function ConfianzaBadge({ nivel, score }: { nivel: NivelConfianza; score: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${ESTILO[nivel]}`}
    >
      Confianza {nivel} · {score}%
    </span>
  );
}
