'use client';

import type { FiltroTipoContrato, TableroAlquileresDto } from '@vacker/types';
import { Card } from '@vacker/ui';
import { fmtMoneda, fmtNum } from '../../../lib/format';
import { CLASE_FOCO, Segmentado } from '../piezas';
import { suma } from './formatos';

const TIPOS: [FiltroTipoContrato, string][] = [
  ['todos', 'Todos'],
  ['vivienda', 'Particulares'],
  ['comercial', 'Comerciales'],
];

/**
 * Todos / Particulares / Comerciales (punto 8 de Javier: «es importante»).
 * Filtra el tablero entero. El botón elegido se marca al instante: la API
 * tarda en traer los números, y sin eso parecía que no andaba (Javier,
 * 6/10/2026).
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

/**
 * Cómo se reparte la cartera vigente entre particulares y comerciales. Una
 * fila por tipo, con su propia barra: cuántos contratos, cuánto alquiler por
 * mes y qué parte del total es. La barra única con la leyenda lejos «no se
 * entendía» (Javier, 6/10/2026). Tocar una fila filtra el tablero. Es a hoy.
 */
export function RepartoTipo({
  porTipo,
  onElegir,
}: {
  porTipo: TableroAlquileresDto['cartera']['porTipo'];
  onElegir: (tipo: FiltroTipoContrato) => void;
}) {
  if (porTipo.every((x) => x.cantidad === 0)) return null;
  const contratos = suma(porTipo.map((x) => x.cantidad));
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        <span aria-hidden>⚖️</span> Particulares y comerciales
        <span className="font-normal normal-case tracking-normal">
          {' '}
          · qué parte del alquiler mensual en pesos es de cada tipo, a hoy
        </span>
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {porTipo.map((x) => (
          <li key={x.tipo}>
            <button
              type="button"
              onClick={() => onElegir(x.tipo)}
              className={`group w-full rounded-brand text-left ${CLASE_FOCO}`}
              title={`Ver solo ${x.tipo === 'vivienda' ? 'particulares' : 'comerciales'}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-semibold text-ink group-hover:text-brand-red">
                  {x.tipo === 'vivienda' ? 'Particulares' : 'Comerciales'}{' '}
                  <span className="font-normal text-muted">
                    · {x.cantidad} de {contratos} {contratos === 1 ? 'contrato' : 'contratos'}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums text-muted">
                  {fmtMoneda(x.importe, 'ARS')} por mes ·{' '}
                  <span className="font-bold text-ink">{fmtNum(x.pct)}%</span>
                </span>
              </span>
              <span
                className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-surface"
                aria-hidden
              >
                <span
                  style={{ width: `${x.pct}%` }}
                  className={`block h-full rounded-full ${x.tipo === 'vivienda' ? 'bg-brand-red' : 'bg-ink/60'}`}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
