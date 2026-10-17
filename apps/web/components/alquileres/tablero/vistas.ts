import type {
  DetalleTableroQuery,
  FilaTablero,
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
  | 'cobrado'
  | 'falta'
  | 'estado';

/** Las columnas que son plata: van a la derecha, sin cortarse, y pueden llevar total. */
export const COLUMNAS_DE_PLATA: readonly Columna[] = ['alquiler', 'importe', 'cobrado', 'falta'];

/**
 * Una fila del detalle. La de la cobranza del mes (regla 187) suma lo
 * cobrado y lo que falta, que se arman en el navegador: la API no los manda.
 */
export type FilaDetalle = FilaTablero & { cobrado?: number | null; falta?: number | null };
export interface IndicadorDetalle {
  valor: number;
  filas: FilaDetalle[];
}

/**
 * La lista de un número que se pide (regla 79), con TODO lo que la define
 * —también el corte—: es la clave de la memoria de listas (regla 189).
 */
export type Pedido = DetalleTableroQuery;

/**
 * El detalle de un número: la lista, con las columnas que sirven para ESE
 * número (Javier, 6/10/2026: «en cada uno pone información relevante»), y a
 * dónde ir a resolverlo si es una tarea.
 *
 * Lo que es a hoy viaja con el tablero (`indicador`); lo de un período se pide
 * (`pedido`, regla 79), en segundo plano o al abrirlo (reglas 189 y 190).
 */
export interface Detalle {
  titulo: string;
  /** Una línea debajo del título que dice qué suma la lista (regla 187). */
  resumen?: string;
  indicador?: IndicadorDetalle;
  pedido?: Pedido;
  columnas: [Columna, string][];
  /** Si el número es un importe, la lista lleva total, por moneda; la fila sin moneda va en esta. */
  total?: MonedaAlquiler;
  /** Las columnas que llevan total. Sin esto, `importe`. */
  sumar?: Columna[];
  accion?: { href: string; texto: string };
  /** Volver a de dónde se llegó: un mes de «Cobrado dentro del mes» vuelve a la cuenta (regla 188). */
  volver?: { texto: string; ir: () => void };
}

/** Abre el detalle de un número que viaja con el tablero: lo de hoy, con su lista. */
export type Abrir = (
  titulo: string,
  indicador: IndicadorDetalle,
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
  // Regla 179: el plazo ya se cumplió; «Faltan: hace 5 días» se contradecía.
  plazoCumplido: [
    ...DE_CONTRATO,
    ['alquiler', 'Alquiler hoy'],
    ['vence', 'Venció'],
    ['dias', 'Hace'],
  ],
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
  // Regla 187: la cobranza del mes, con lo cobrado y lo que falta de cada alquiler.
  cobranzaDelMes: [
    ['inquilino', 'Inquilino'],
    ['propiedad', 'Propiedad'],
    ['contrato', 'Contrato'],
    ['fecha', 'Vence'],
    ['importe', 'Alquiler'],
    ['cobrado', 'Cobrado'],
    ['falta', 'Falta'],
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
