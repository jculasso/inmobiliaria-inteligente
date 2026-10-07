'use client';

import { useRef, useState } from 'react';
import { escribirImporte, leerImporte, leerNumero } from '../lib/importe';
import { inputClass } from './form-ui';

/**
 * El campo de un importe: con su moneda a la izquierda, teclado con coma en el
 * teléfono, y al salir del campo se ve como se lee —«200.000,00»—, con miles
 * y centavos. Lo escrito se interpreta con `leerImporte`, el mismo lector de
 * todo el módulo.
 */
export function InputImporte({
  value,
  onChange,
  moneda = 'ARS',
  className = '',
  ...rest
}: {
  value: string;
  onChange: (texto: string) => void;
  moneda?: 'ARS' | 'USD';
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
>) {
  // Un campo en cero («0,00») se selecciona entero al entrar: si no, el cursor
  // queda al final, lo escrito se suma detrás («0,0030000») y se lee 0
  // (prueba en producción, 6/10/2026, con el informe de garantía).
  const recienEnfocado = useRef(false);
  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted"
      >
        {moneda === 'USD' ? 'U$S' : '$'}
      </span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${inputClass} text-right tabular-nums ${moneda === 'USD' ? 'pl-12' : 'pl-7'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          if (leerImporte(value) === 0) {
            e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
            recienEnfocado.current = true;
          }
          rest.onFocus?.(e);
        }}
        onMouseUp={(e) => {
          // El clic que enfocó soltaría la selección al levantar el dedo.
          if (recienEnfocado.current) e.preventDefault();
          recienEnfocado.current = false;
          rest.onMouseUp?.(e);
        }}
        onBlur={(e) => {
          recienEnfocado.current = false;
          const n = leerImporte(value);
          if (n != null && !Number.isNaN(n)) onChange(escribirImporte(n));
          rest.onBlur?.(e);
        }}
      />
    </div>
  );
}

/**
 * Lo mismo, para un importe que vive como número en el estado (una fila de una
 * lista). Guarda el texto mientras se escribe —si no, «123,» se volvía «123»
 * y la coma desaparecía, y el campo no se podía vaciar— y avisa el número.
 */
export function InputImporteNumero({
  valor,
  onValor,
  ...rest
}: { valor: number | null; onValor: (n: number | null) => void } & Omit<
  Parameters<typeof InputImporte>[0],
  'value' | 'onChange'
>) {
  const [texto, setTexto] = useState(escribirImporte(valor));
  return (
    <InputImporte
      {...rest}
      value={texto}
      onChange={(t) => {
        setTexto(t);
        const n = leerImporte(t);
        onValor(n == null || Number.isNaN(n) ? null : n);
      }}
    />
  );
}

/**
 * Un porcentaje que vive como texto en el estado (el alta de contrato lo lee
 * recién al guardar, con `leerNumero`). Se ve igual que `InputPorcentaje`: a la
 * derecha, con el «%» adentro del campo.
 */
export function InputPorcentajeTexto({
  value,
  onChange,
  className = '',
  ...rest
}: { value: string; onChange: (texto: string) => void; className?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
>) {
  return (
    <div className={`relative ${className}`}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${inputClass} pr-8 text-right tabular-nums`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted"
      >
        %
      </span>
    </div>
  );
}

/** Un porcentaje que vive como número: deja escribir «8,» y vaciar el campo. */
export function InputPorcentaje({
  valor,
  onValor,
  ...rest
}: { valor: number; onValor: (n: number) => void } & Omit<
  Parameters<typeof InputPorcentajeTexto>[0],
  'value' | 'onChange'
>) {
  const [texto, setTexto] = useState(String(valor).replace('.', ','));
  return (
    <InputPorcentajeTexto
      {...rest}
      value={texto}
      onChange={(t) => {
        setTexto(t);
        const n = leerNumero(t);
        onValor(n == null || Number.isNaN(n) ? 0 : n);
      }}
    />
  );
}
