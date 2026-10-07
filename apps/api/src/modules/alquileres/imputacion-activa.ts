import type { Prisma } from '@prisma/client';
import { redondear2 } from '@vacker/domain';

/**
 * Una imputación cuenta si su cobro no está anulado Y el cobro en el que se
 * registró tampoco: anular un cobro revierte también el saldo a favor que se
 * aplicó al registrarlo (regla 19).
 *
 * Es el único filtro: saldos, «aplicado» de un concepto y anulaciones lo usan
 * igual. Si cada uno filtrara a su manera, un concepto podría figurar pagado en
 * una pantalla y pendiente en otra.
 */
export const IMPUTACION_ACTIVA = {
  cobro: { anuladoEn: null },
  registradaEnCobro: { anuladoEn: null },
} satisfies Prisma.AlqImputacionWhereInput;

/**
 * Lo que queda de un concepto: su importe menos lo imputado por cobros activos
 * (las imputaciones tienen que venir ya filtradas con `IMPUTACION_ACTIVA`). Un
 * concepto liquidado quedó saldado con el propietario (regla 20): no le queda
 * nada.
 *
 * Es el saldo de la cuenta corriente y de los cobros; «Adelantado sin
 * recuperar» de Impuestos y servicios (regla 50) usa este mismo, así una
 * boleta no puede figurar recuperada en una pantalla y pendiente en otra.
 */
export function saldoDeConcepto(k: {
  importe: Prisma.Decimal | number;
  liquidacionId: string | null;
  imputaciones: { importe: Prisma.Decimal | number }[];
}): number {
  if (k.liquidacionId) return 0;
  const imputado = k.imputaciones.reduce((s, i) => s + Number(i.importe), 0);
  return redondear2(Number(k.importe) - imputado);
}
