import type { EstadoContrato } from '@vacker/types';
import { Insignia, type TonoInsignia } from './piezas';

const TONO: Record<EstadoContrato, TonoInsignia> = {
  borrador: 'neutro',
  vigente: 'exito',
  finalizado: 'neutro',
  rescindido: 'marca',
};

const NOMBRE: Record<EstadoContrato, string> = {
  borrador: 'Borrador',
  vigente: 'Vigente',
  finalizado: 'Finalizado',
  rescindido: 'Rescindido',
};

export function EstadoContratoBadge({ estado }: { estado: EstadoContrato }) {
  return <Insignia tono={TONO[estado]}>{NOMBRE[estado]}</Insignia>;
}
