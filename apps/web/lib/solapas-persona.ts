import type { EstadoContrato, PapelContrato } from '@vacker/types';

/**
 * Las solapas de la ficha de una persona. Viven fuera del componente, que se
 * usa desde uno `'use client'`: la página del servidor lee la solapa de la
 * dirección (`?solapa=informe`) y no puede llamar funciones de un módulo
 * cliente (ver `server-imports.test.ts`).
 */
export const SOLAPAS_PERSONA = [
  'resumen',
  'basica',
  'administrativa',
  'complementarios',
  'cuenta',
  'informe',
] as const;
export type Solapa = (typeof SOLAPAS_PERSONA)[number];

/** La solapa de la dirección; lo que no se entiende, el resumen. */
export function leerSolapa(valor: string | undefined): Solapa {
  return (SOLAPAS_PERSONA as readonly string[]).includes(valor ?? '')
    ? (valor as Solapa)
    : 'resumen';
}

/**
 * Regla 83: la solapa «Informe» es de quien es propietario en algún contrato
 * que ya es contrato (ni borrador ni anulado): lo mismo que mira la API.
 */
export function tieneInforme(
  contratos: { papel: PapelContrato; estado: EstadoContrato }[],
): boolean {
  return contratos.some(
    (c) => c.papel === 'propietario' && c.estado !== 'borrador' && c.estado !== 'anulado',
  );
}
