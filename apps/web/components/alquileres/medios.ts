import type { MedioCobro } from '@vacker/types';

/**
 * Los medios de pago, en el orden en que se ofrecen: el más usado primero.
 * Había cuatro copias —cobros, liquidaciones, boletas y proveedores— y cada
 * una podía quedar con un medio de menos.
 */
export const MEDIOS_COBRO: readonly MedioCobro[] = ['transferencia', 'efectivo', 'cheque', 'otro'];

export const NOMBRE_MEDIO: Record<MedioCobro, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  otro: 'Otro',
};
