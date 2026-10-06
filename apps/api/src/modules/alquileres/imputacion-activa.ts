import type { Prisma } from '@prisma/client';

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
