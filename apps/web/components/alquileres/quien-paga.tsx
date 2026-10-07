'use client';

import {
  COMBINACIONES_QUIEN_PAGA,
  consecuenciaDeBoleta,
  type ParteDeudora,
  type QuienPaga,
} from '@vacker/types';
import { Campo, inputClass } from '../form-ui';

export type QuienPagaValor = { aCargoDe: ParteDeudora; paga: QuienPaga };

const clave = ({ aCargoDe, paga }: QuienPagaValor) => `${aCargoDe}|${paga}`;

/**
 * Quién la debe y quién la paga en UN campo, con la consecuencia escrita
 * («La paga la inmobiliaria y se le cobra al inquilino en su próximo
 * recibo»), en vez de «La debe» y «La paga» por separado (regla 46). Lo usan
 * los impuestos de cada propiedad y las pólizas: las dos terminan en boletas,
 * y tienen que preguntarlo con las mismas palabras.
 */
export function SelectQuienPaga({
  valor,
  onChange,
}: {
  valor: QuienPagaValor;
  onChange: (v: QuienPagaValor) => void;
}) {
  return (
    <Campo label="Quién la paga y a quién se le carga">
      <select
        className={inputClass}
        value={clave(valor)}
        onChange={(e) => {
          const [aCargoDe, paga] = e.target.value.split('|') as [ParteDeudora, QuienPaga];
          onChange({ aCargoDe, paga });
        }}
      >
        {COMBINACIONES_QUIEN_PAGA.map((c) => (
          <option key={clave(c)} value={clave(c)}>
            {consecuenciaDeBoleta(c.aCargoDe, c.paga)}
          </option>
        ))}
      </select>
    </Campo>
  );
}
