// Los marcadores de cada documento que se arma desde una plantilla de Word
// (reglas 39, 162 y 174): el contrato, la reserva y el anexo de inventario.
import {
  MARCADORES_PLANTILLA,
  type DocumentoPlantilla,
  type MarcadorPlantilla,
} from './alquileres';
import { MARCADORES_RESERVA } from './reservas';

/**
 * Los marcadores del anexo de inventario (regla 174; Florencia, Vacker,
 * 15/10/2026: «lo mejor es que sea un apéndice del contrato»). Son los del
 * contrato que tienen sentido en el anexo —quién, qué propiedad, cuándo— y el
 * inventario. Salen de `MARCADORES_PLANTILLA`, no se copian: el anexo se
 * completa con los mismos datos que el contrato y no puede decir otra cosa.
 */
const NOMBRES_DEL_ANEXO = [
  'inmobiliaria',
  'contrato.codigo',
  'contrato.tipo',
  'contrato.inicio',
  'contrato.fin',
  'contrato.firma',
  'propiedad.direccion',
  'propiedad.ciudad',
  'propietarios.texto',
  'inquilinos.texto',
  'fecha.hoy',
  'contrato.inventario_observaciones',
  'con_inventario',
  'propietarios',
  'inquilinos',
  'inventario',
];

export const MARCADORES_ANEXO_INVENTARIO: readonly MarcadorPlantilla[] =
  MARCADORES_PLANTILLA.filter((m) => NOMBRES_DEL_ANEXO.includes(m.nombre));

/** Contra qué lista se revisa y se completa cada tipo de plantilla. */
export const MARCADORES_POR_DOCUMENTO: Record<DocumentoPlantilla, readonly MarcadorPlantilla[]> = {
  contrato: MARCADORES_PLANTILLA,
  reserva: MARCADORES_RESERVA,
  inventario: MARCADORES_ANEXO_INVENTARIO,
};
