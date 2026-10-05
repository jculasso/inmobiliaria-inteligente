import type { LadoPunta } from '@vacker/types';

/**
 * Qué se cuenta en la ventana de detalle que abre una tarjeta del tablero.
 *
 * LA REGLA: lo que muestra la ventana tiene que sumar EXACTAMENTE el número de
 * la tarjeta que se tocó. Si no, el detalle desmiente al tablero.
 *
 * Hasta el 5/10/2026 no pasaba. Las ocho tarjetas de cada fila del dashboard
 * abrían la misma lista —todas las ventas del período, sin filtrar estado— con
 * la comisión completa de cada operación. Las tarjetas, en cambio, cuentan solo
 * escrituradas, y «Com. comprador» suma solo las puntas compradoras. Javier:
 * «si te parás sobre comisión comprador o comisión vendedor o sobre la comisión
 * total trae cualquier cosa».
 *
 * Las cuentas son las de `agregar` en `apps/api/.../kpis.calc.ts`, sobre las
 * puntas: cada punta aporta el PRECIO COMPLETO de la operación al volumen y su
 * propia comisión. Una venta con las dos puntas suma dos veces su precio.
 */

/** La métrica de la tarjeta que se tocó: es la que se resalta en la ventana. */
export type FocoDrill = 'volumen' | 'operaciones' | 'ticket' | 'puntas' | 'comision';

interface PuntaDrill {
  lado: string;
  usuarioId: string;
  comision: number;
}

export interface OperacionDrill {
  precio: number | null;
  valorMensual: number | null;
  comTotal: number;
  puntas: PuntaDrill[];
}

export interface Contadas<T> {
  op: T;
  /** Las puntas de esta operación que entran en la cuenta de la tarjeta. */
  puntas: PuntaDrill[];
  /** Su comisión: la de esas puntas, no la de la operación entera. */
  comision: number;
}

export interface ResumenDrill {
  operaciones: number;
  puntas: number;
  volumen: number;
  ticket: number;
  comision: number;
}

/**
 * Las operaciones que cuenta la tarjeta, cada una con las puntas que aporta.
 *
 * - `usuarioId`: se abrió desde la fila de un vendedor → solo sus puntas.
 * - `lado`: se abrió desde «Puntas compradoras» o «Com. comprador» → solo ese
 *   lado, y la venta que no tiene una punta de ese lado no aparece.
 *
 * El servidor ya devuelve solo las puntas que la persona puede ver («ver solo
 * lo mío»), así que acá no hay que acotar por alcance.
 */
export function contarVentas<T extends OperacionDrill>(
  ops: T[],
  { usuarioId, lado }: { usuarioId?: string; lado?: LadoPunta } = {},
): Contadas<T>[] {
  return ops
    .map((op) => {
      const puntas = op.puntas.filter(
        (p) => (!usuarioId || p.usuarioId === usuarioId) && (!lado || p.lado === lado),
      );
      return { op, puntas, comision: puntas.reduce((s, p) => s + p.comision, 0) };
    })
    .filter((c) => c.puntas.length > 0);
}

/** Lo mismo que muestra la tarjeta, recalculado sobre lo que lista la ventana. */
export function resumirVentas(contadas: Contadas<OperacionDrill>[]): ResumenDrill {
  const puntas = contadas.reduce((s, c) => s + c.puntas.length, 0);
  const volumen = contadas.reduce((s, c) => s + (c.op.precio ?? 0) * c.puntas.length, 0);
  return {
    operaciones: contadas.length,
    puntas,
    volumen,
    ticket: puntas ? volumen / puntas : 0,
    comision: contadas.reduce((s, c) => s + c.comision, 0),
  };
}
