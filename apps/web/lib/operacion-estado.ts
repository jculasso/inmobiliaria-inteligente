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

/** Verde para lo cerrado (escriturada/firmado), rojo de marca para lo que sigue en curso. */
export function estadoClass(estado: string): string {
  return estado === 'escriturada' || estado === 'firmado'
    ? 'bg-success/10 text-success'
    : 'bg-brand-red/10 text-brand-red';
}

/** Clases de la insignia completa, para no repetir el pill en cada tabla. */
export function estadoBadgeClass(estado: string): string {
  return `inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${estadoClass(estado)}`;
}
