/**
 * Las tres pestañas de Impuestos y servicios (regla 45). Vive fuera de
 * `impuestos-vista.tsx` a propósito: ese archivo es `'use client'`, y la
 * página —que corre en el servidor— necesita `vistaImpuestos()` para saber qué
 * datos pedir. Una función exportada desde un módulo cliente no se puede
 * llamar desde el servidor: en producción la página entera cae con «Algo salió
 * mal» (7/10/2026). Lo protege `server-imports.test.ts`.
 */
export type VistaImpuestos = 'pagar' | 'cargar' | 'propiedades';

export const VISTAS_IMPUESTOS: readonly (readonly [VistaImpuestos, string])[] = [
  ['pagar', 'Para pagar'],
  ['cargar', 'Cargar el mes'],
  ['propiedades', 'Qué tiene cada propiedad'],
];

/**
 * La pestaña pedida por `?ver=`. Lo desconocido —y los `?ver=control` y
 * `?ver=mes` de antes del 7/10/2026, que pueden haber quedado en un marcador—
 * abre «Para pagar».
 */
export function vistaImpuestos(ver: string | undefined): VistaImpuestos {
  return VISTAS_IMPUESTOS.some(([v]) => v === ver) ? (ver as VistaImpuestos) : 'pagar';
}
