'use client';

import type { FiltroTipoContrato } from '@vacker/types';
import { Segmentado } from '../piezas';

const TIPOS: [FiltroTipoContrato, string][] = [
  ['todos', 'Todos'],
  ['vivienda', 'Particulares'],
  ['comercial', 'Comerciales'],
];

/**
 * Todos / Particulares / Comerciales (punto 8 de Javier: «es importante»).
 * Desde el 17/10/2026 filtra solo «Cómo vamos» (regla 182): «Hoy» y lo que
 * hay que hacer son de toda la cartera. El botón elegido se marca al
 * instante: sin eso parecía que no andaba (Javier, 6/10/2026).
 */
export function FiltroTipo({
  tipo,
  cambiar,
}: {
  tipo: FiltroTipoContrato;
  cambiar: (tipo: FiltroTipoContrato) => void;
}) {
  return (
    <Segmentado etiqueta="Tipo de contrato" opciones={TIPOS} valor={tipo} onCambio={cambiar} />
  );
}
