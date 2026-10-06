import type { TonoInsignia } from '../components/piezas';

/**
 * Estado de una operación, en un solo lugar.
 *
 * Vivía dentro de `operaciones-table`, así que el modal de detalle mostraba el
 * enum crudo de la base ("escriturada", "senada") mientras la tabla mostraba
 * una insignia prolija. Mismo dato, dos aspectos distintos según por dónde se
 * llegara.
 */

/** Etiquetas legibles (la base guarda el enum en minúsculas). */
export const ESTADO_LABEL: Record<string, string> = {
  escriturada: 'Escriturada',
  senada: 'Señada',
  reservada: 'Reservada',
  boleto: 'Boleto',
  firmado: 'Firmado',
  reservado: 'Reservado',
  pendiente: 'Pendiente',
};

export function estadoLabel(estado: string): string {
  return ESTADO_LABEL[estado] ?? estado;
}

/** Lo cerrado: la operación ya está hecha. */
const CERRADOS = new Set(['escriturada', 'firmado']);
/** Lo que sigue en curso: falta un paso para cerrarse. */
const EN_CURSO = new Set(['senada', 'reservada', 'boleto', 'reservado', 'pendiente']);

/**
 * El tono de la insignia (`Insignia` de `components/piezas`): verde lo cerrado,
 * ámbar lo que sigue en curso y gris lo que no se reconoce (un estado
 * cancelado o anulado, si algún día existe, ya no cuenta).
 *
 * Lo en curso iba en `brand-red`, el color de cada inmobiliaria: en una marca
 * verde, una seña se veía igual que una escritura, y en la roja de Vacker
 * parecía un error. Una seña no es urgente ni está mal: está pendiente
 * (CONVENCIONES_TECNICAS §13).
 */
export function estadoTono(estado: string): TonoInsignia {
  if (CERRADOS.has(estado)) return 'exito';
  if (EN_CURSO.has(estado)) return 'aviso';
  return 'neutro';
}
