import { z } from 'zod';
import { AlertaProtocoloSchema, NivelAlertaSchema } from './protocolo';

// Contrato del reporte semanal del Protocolo 5 Semanas: el que se le manda por
// mail a la dirección y el que se ve en pantalla cuando lo corren a pedido.
//
// Vive acá y no en el módulo de la API porque lo consumen los dos lados: el
// generador que arma el mail y la pantalla que lo muestra. Dos definiciones se
// separan con el tiempo y la que queda vieja es la que rompe algo.
//
// Especificación: docs/specs/reporte-semanal-protocolo.md

/**
 * Quién puede pedir el reporte a demanda: la dirección y el admin de la
 * inmobiliaria. Es información de conducción, no de trabajo diario.
 *
 * UNA sola definición, usada por el `@Roles` del controller y por el gate de
 * la web. `ROLES_PUBLICACION` se escribió dos veces, las listas se separaron y
 * la API devolvía 403 que el front mostraba como "no pudimos conectar con el
 * servidor". Hay un test que verifica que sigan siendo la misma lista.
 */
export const ROLES_REPORTE_PROTOCOLO = ['direccion', 'admin_tenant'] as const;

/** Estado de una de las cinco semanas del protocolo (regla 6). */
export const EstadoSemanaSchema = z.enum(['futura', 'completa', 'en_curso', 'incompleta']);
export type EstadoSemana = z.infer<typeof EstadoSemanaSchema>;

export const ESTADO_SEMANA_LABEL: Record<EstadoSemana, string> = {
  futura: 'Todavía no empezó',
  completa: 'Completa',
  en_curso: 'En curso',
  incompleta: 'Quedó incompleta',
};

export const SemanaEnReporteSchema = z.object({
  semana: z.number().int(),
  estado: EstadoSemanaSchema,
  /** Acciones vencidas y sin cerrar de esta semana. */
  atrasadas: z.number().int(),
  /** Acciones aplicables todavía sin realizar (incluye las atrasadas). */
  pendientes: z.number().int(),
  /** Alertas atribuidas a esta semana (regla 7). */
  alertas: z.array(AlertaProtocoloSchema),
});
export type SemanaEnReporte = z.infer<typeof SemanaEnReporteSchema>;

export const PropiedadEnReporteSchema = z.object({
  protocoloId: z.string().uuid(),
  direccion: z.string(),
  semanaActual: z.number().int(),
  prioridad: NivelAlertaSchema,
  /**
   * El protocolo llegó al final del recorrido: la semana 5 está completa.
   *
   * NO significa que no quede nada por hacer — ver `pendientesArrastrados`.
   * La dirección decidió que una propiedad se puede cerrar con tareas
   * pendientes, a condición de que el reporte lo diga con todas las letras.
   */
  listoParaCierre: z.boolean(),
  /** Acciones aplicables sin realizar de semanas YA PASADAS. */
  pendientesArrastrados: z.number().int(),
  /** Alertas sin semana: son de la propiedad, no del proceso (regla 7). */
  alertasGenerales: z.array(AlertaProtocoloSchema),
  semanas: z.array(SemanaEnReporteSchema),
});
export type PropiedadEnReporte = z.infer<typeof PropiedadEnReporteSchema>;

export const VendedorEnReporteSchema = z.object({
  vendedorId: z.string().uuid(),
  vendedorNombre: z.string(),
  propiedades: z.array(PropiedadEnReporteSchema),
  /** Cuántas de sus propiedades tienen al menos una alerta roja. */
  conRojas: z.number().int(),
});
export type VendedorEnReporte = z.infer<typeof VendedorEnReporteSchema>;

export const ResumenReporteSchema = z.object({
  activas: z.number().int(),
  conRojas: z.number().int(),
  autorizacionesEnRiesgo: z.number().int(),
  listasParaCierre: z.number().int(),
  /** De las listas para cierre, cuántas arrastran tareas sin cerrar. */
  listasConPendientes: z.number().int(),
});
export type ResumenReporte = z.infer<typeof ResumenReporteSchema>;

export const ItemDecisionSchema = z.object({
  vendedorNombre: z.string(),
  direccion: z.string(),
  protocoloId: z.string().uuid(),
  alertas: z.array(AlertaProtocoloSchema),
});
export type ItemDecision = z.infer<typeof ItemDecisionSchema>;

export const ReporteSemanalSchema = z.object({
  generadoEl: z.string(),
  resumen: ResumenReporteSchema,
  /**
   * Si es `false` no hay nada rojo y el mail va corto: solo el resumen
   * (regla 9). Un mail que mide siempre lo mismo se ignora enseguida.
   */
  necesitaAtencion: z.boolean(),
  /** Solo lo rojo, de todos los vendedores. Es lo primero que se lee (regla 5). */
  necesitaDecision: z.array(ItemDecisionSchema),
  porVendedor: z.array(VendedorEnReporteSchema),
});
export type ReporteSemanal = z.infer<typeof ReporteSemanalSchema>;

/**
 * Cómo se anuncia el cierre de una propiedad, en una frase.
 *
 * Existe para que el mail y la pantalla digan lo MISMO: el estado "listo para
 * cierre con tareas pendientes" es justo el que se malinterpreta si cada lado
 * lo redacta a su manera.
 */
export function textoDeCierre(p: {
  listoParaCierre: boolean;
  pendientesArrastrados: number;
}): string | null {
  if (!p.listoParaCierre) return null;
  if (p.pendientesArrastrados === 0) return 'Listo para cierre';
  const n = p.pendientesArrastrados;
  return `Listo para cierre · ${n} ${n === 1 ? 'tarea pendiente' : 'tareas pendientes'} de semanas anteriores`;
}
