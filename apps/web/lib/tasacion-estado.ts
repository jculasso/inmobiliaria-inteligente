import type { TasacionDto } from '@vacker/types';

/** Texto de detalle bajo el badge de estado (exclusividad al captar, motivo al no captar). */
export function detalleEstado(t: Pick<TasacionDto, 'estado' | 'exclusividad' | 'motivoNoCaptada'>): string | null {
  if (t.estado === 'Captada' && t.exclusividad) {
    return t.exclusividad.tipo === 'exclusiva' ? `Exclusiva ${t.exclusividad.dias} días` : 'No exclusiva';
  }
  if (t.estado === 'No captada' && t.motivoNoCaptada) return t.motivoNoCaptada;
  return null;
}

export function estadoClass(estado: string): string {
  if (estado === 'Captada') return 'bg-success/10 text-success';
  if (estado === 'No captada') return 'bg-brand-red/10 text-brand-red';
  return 'bg-surface text-muted';
}
