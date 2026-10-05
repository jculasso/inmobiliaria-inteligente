import type { EstadoContrato } from '@vacker/types';

const ESTILO: Record<EstadoContrato, string> = {
  borrador: 'bg-surface text-muted',
  vigente: 'bg-success/10 text-success',
  finalizado: 'bg-ink/5 text-ink/60',
  rescindido: 'bg-brand-red/10 text-brand-red',
};

const NOMBRE: Record<EstadoContrato, string> = {
  borrador: 'Borrador',
  vigente: 'Vigente',
  finalizado: 'Finalizado',
  rescindido: 'Rescindido',
};

export function EstadoContratoBadge({ estado }: { estado: EstadoContrato }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${ESTILO[estado]}`}>{NOMBRE[estado]}</span>;
}
