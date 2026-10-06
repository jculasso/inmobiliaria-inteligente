import type { EstadoTasacion, TasacionDto } from '@vacker/types';
import type { TonoInsignia } from '../components/piezas';

/** Texto de detalle bajo el badge de estado (exclusividad al captar, motivo al no captar). */
export function detalleEstado(
  t: Pick<TasacionDto, 'estado' | 'exclusividad' | 'motivoNoCaptada'>,
): string | null {
  if (t.estado === 'Captada' && t.exclusividad) {
    return t.exclusividad.tipo === 'exclusiva'
      ? `Exclusiva ${t.exclusividad.dias} días`
      : 'No exclusiva';
  }
  if (t.estado === 'No captada' && t.motivoNoCaptada) return t.motivoNoCaptada;
  return null;
}

/**
 * El tono de la `Insignia` de cada estado, el mismo criterio que las ventas:
 * lo logrado `exito`, lo que espera respuesta `aviso`, lo perdido `peligro` y
 * lo que recién arranca `neutro`. «No captada» iba con el color de la marca:
 * en una inmobiliaria verde, una captación perdida se veía verde (§13).
 */
export const TONO_ESTADO_TASACION: Record<EstadoTasacion, TonoInsignia> = {
  'En proceso': 'neutro',
  Presentada: 'aviso',
  Captada: 'exito',
  'No captada': 'peligro',
};

export function tonoEstadoTasacion(estado: string): TonoInsignia {
  return TONO_ESTADO_TASACION[estado as EstadoTasacion] ?? 'neutro';
}
