import type {
  DetalleTableroQuery,
  FiltroTipoContrato,
  Indicador,
  IndicadorDetalleTablero,
  MonedaAlquiler,
  TramoMora,
} from '@vacker/types';

export type Moneda = MonedaAlquiler;

/** Las columnas que puede mostrar el detalle de un número. */
export type Columna =
  | 'contrato'
  | 'propiedad'
  | 'inquilino'
  | 'propietario'
  | 'persona'
  | 'alquiler'
  | 'indexa'
  | 'vence'
  | 'detalle'
  | 'fecha'
  | 'dias'
  | 'importe'
  | 'estado';

/** La lista de un número del período que se pide al abrirlo (regla 79). */
export type Pedido = Omit<DetalleTableroQuery, 'tipo'>;

/**
 * El detalle de un número: la lista, con las columnas que sirven para ESE
 * número (Javier, 6/10/2026: «en cada uno pone información relevante»), y a
 * dónde ir a resolverlo si es una tarea.
 *
 * Lo que es a hoy viaja con el tablero (`indicador`); lo de un período se pide
 * al abrirlo (`pedido`, regla 79).
 */
export interface Detalle {
  titulo: string;
  indicador?: Indicador;
  pedido?: Pedido;
  columnas: [Columna, string][];
  /** Si el número es un importe, la columna `importe` suma y lleva total. */
  total?: MonedaAlquiler;
  accion?: { href: string; texto: string };
  /**
   * El corte con que se pide la lista. Sin él, el del filtro de «Cómo vamos»;
   * lo de «Hoy» es siempre de toda la cartera (regla 177).
   */
  tipo?: FiltroTipoContrato;
}

/** Abre el detalle de un número que viaja con el tablero: lo de hoy, con su lista. */
export type Abrir = (
  titulo: string,
  indicador: Indicador,
  columnas: [Columna, string][],
  extra?: Partial<Detalle>,
) => () => void;

/** Abre la lista de un número del período: se pide al abrirla (regla 79). */
export type Pedir = (
  titulo: string,
  indicador: IndicadorDetalleTablero,
  moneda: Moneda,
  columnas: [Columna, string][],
  extra?: Partial<Detalle> & { tramo?: TramoMora },
) => () => void;

const DE_CONTRATO: [Columna, string][] = [
  ['contrato', 'Contrato'],
  ['propiedad', 'Propiedad'],
  ['inquilino', 'Inquilino'],
  ['propietario', 'Propietario'],
];
export const VISTAS = {
  contratos: [
    ...DE_CONTRATO,
    ['alquiler', 'Alquiler hoy'],
    ['indexa', 'Próx. indexación'],
    ['vence', 'Vence'],
  ],
  alquilerMensual: [
    ...DE_CONTRATO,
    ['importe', 'Alquiler del mes'],
    ['indexa', 'Próx. indexación'],
    ['vence', 'Vence'],
  ],
  vencen: [...DE_CONTRATO, ['alquiler', 'Alquiler hoy'], ['vence', 'Vence'], ['dias', 'Faltan']],
  nuevos: [
    ...DE_CONTRATO,
    ['fecha', 'Empieza'],
    ['importe', 'Alquiler inicial'],
    ['vence', 'Vence'],
    ['estado', 'Estado'],
  ],
  cobranza: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['fecha', 'Vence'],
    ['importe', 'Alquiler'],
    ['estado', 'Estado'],
  ],
  cobrado: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['fecha', 'Vence'],
    ['importe', 'Cobrado'],
    ['estado', 'Estado'],
  ],
  ingresos: [
    ['fecha', 'Fecha'],
    ['detalle', 'Concepto'],
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['persona', 'De quién'],
    ['importe', 'Importe'],
  ],
  mora: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Concepto'],
    ['fecha', 'Venció'],
    ['dias', 'Atraso'],
    ['importe', 'Saldo'],
  ],
  indexaciones: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Tramo'],
    ['fecha', 'Desde'],
    ['alquiler', 'Alquiler hoy'],
    ['importe', 'Nuevo'],
    ['estado', 'Estado'],
  ],
  escalones: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Escalón'],
    ['fecha', 'Desde'],
    ['dias', 'Faltan'],
    ['alquiler', 'Alquiler hoy'],
    ['importe', 'Nuevo'],
  ],
  depositos: [...DE_CONTRATO, ['vence', 'Termina'], ['estado', 'Estado'], ['importe', 'Depósito']],
  liquidaciones: [
    ['propietario', 'Propietario'],
    ['contrato', 'Contratos'],
    ['propiedad', 'Propiedades'],
    ['inquilino', 'Inquilinos'],
    ['estado', 'En espera'],
    ['importe', 'Neto a liquidar'],
  ],
  deudores: [
    ['inquilino', 'Inquilino'],
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['propietario', 'Propietario'],
    ['detalle', 'Qué debe'],
    ['fecha', 'Debe desde'],
    ['dias', 'Atraso'],
    ['importe', 'Deuda'],
  ],
  sinFirmar: [...DE_CONTRATO, ['fecha', 'Empezó'], ['vence', 'Vence'], ['estado', 'Qué falta']],
  // Regla 181: los contratos con el alquiler del mes sin generar.
  generar: [...DE_CONTRATO, ['alquiler', 'Alquiler hoy'], ['estado', 'Estado']],
  reclamos: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Asunto'],
    ['fecha', 'Abierto'],
    ['dias', 'Hace'],
    ['estado', 'Prioridad'],
  ],
  polizas: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Inquilino'],
    ['detalle', 'Póliza'],
    ['fecha', 'Vence'],
    ['estado', 'Estado'],
  ],
  boletas: [
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['detalle', 'Qué'],
    ['fecha', 'Vence'],
    ['estado', 'Estado'],
    ['importe', 'Importe'],
  ],
  finales: [
    ['inquilino', 'Inquilino'],
    ['contrato', 'Contrato'],
    ['propiedad', 'Propiedad'],
    ['detalle', 'Qué'],
    ['fecha', 'Vence'],
    ['estado', 'Estado'],
    ['importe', 'Falta cobrar'],
  ],
  // Regla 166: la seña va en `importe`, pero no se totaliza (no es plata del mes).
  reservas: [
    ['detalle', 'Reserva'],
    ['propiedad', 'Propiedad'],
    ['inquilino', 'Interesado'],
    ['fecha', 'Vence'],
    ['estado', 'Estado'],
    ['importe', 'Seña'],
  ],
} satisfies Record<string, [Columna, string][]>;
