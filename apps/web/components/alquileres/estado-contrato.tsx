import { NOMBRE_ESTADO_CONTRATO, type EstadoContrato } from '@vacker/types';
import { Insignia, type TonoInsignia } from './piezas';

const TONO: Record<EstadoContrato, TonoInsignia> = {
  borrador: 'neutro',
  vigente: 'exito',
  finalizado: 'neutro',
  rescindido: 'aviso',
  anulado: 'neutro',
};

export function EstadoContratoBadge({ estado }: { estado: EstadoContrato }) {
  return <Insignia tono={TONO[estado]}>{NOMBRE_ESTADO_CONTRATO[estado]}</Insignia>;
}
