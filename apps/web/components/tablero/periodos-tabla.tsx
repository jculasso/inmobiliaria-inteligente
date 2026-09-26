'use client';

/**
 * Un cuadro de métricas por período: una columna por período, una fila por
 * métrica, y el total al final.
 *
 * Nació para el trimestral de ventas y se generalizó el 25/09/2026, cuando
 * Vacker pidió lo mismo por mes y para alquileres. Lo que cambia entre esos
 * tres usos es QUÉ filas hay y CUÁNTAS columnas; cómo se dibuja, cómo se elige
 * un período y cómo se comporta en el teléfono es lo mismo, y vive acá una sola
 * vez.
 *
 * En el celular NO se convierte en tarjetas, que es lo que hace el resto de las
 * tablas del tablero. Lo que se quiere es comparar un período contra otro, y en
 * tarjetas separadas esa comparación se pierde. Se desplaza de costado con la
 * columna de métricas fija, que es como se lee una planilla en el teléfono.
 */

export interface FilaPeriodos {
  label: string;
  /** Un valor por columna, en el mismo orden que `etiquetas`. */
  valores: number[];
  /**
   * El total ya calculado. No se suma acá: un promedio —el ticket, el valor
   * promedio del alquiler— no se suma, se recalcula sobre los totales, y eso
   * solo lo sabe quien arma la fila.
   */
  total: number;
  formato: (n: number) => string;
  /** Las que abren un bloque llevan una línea arriba. */
  separa?: boolean;
  destaca?: boolean;
}

export function PeriodosTabla({
  etiquetas,
  filas,
  seleccionado,
  onSelect,
  anchoMinimo,
  titulo,
}: {
  etiquetas: string[];
  filas: FilaPeriodos[];
  /** 1..etiquetas.length */
  seleccionado: number;
  onSelect?: (periodo: number) => void;
  /**
   * La clase de ancho mínimo, escrita entera por quien llama: Tailwind solo
   * genera las clases que encuentra literales en el código.
   */
  anchoMinimo: string;
  /** Para lectores de pantalla: de qué es el cuadro. */
  titulo: string;
}) {
  // Con doce columnas de montos el relleno de cuatro no entra ni en un
  // escritorio: se achica para que la planilla se lea sin desplazarla.
  const denso = etiquetas.length > 6;
  const celda = denso ? 'px-2.5' : 'px-4';

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table
        aria-label={titulo}
        className={`w-full ${anchoMinimo} text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap`}
      >
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted [&>th]:border-b [&>th]:border-line">
            {/* Fija: al desplazar de costado hay que seguir sabiendo qué fila
                se está mirando. */}
            <th className="sticky left-0 z-10 bg-white px-4 py-2">Métrica</th>
            {etiquetas.map((etiqueta, i) => (
              <th
                key={etiqueta}
                aria-current={seleccionado === i + 1 ? 'true' : undefined}
                className={`${celda} py-2 text-right ${seleccionado === i + 1 ? 'text-brand-red' : ''}`}
              >
                {onSelect ? (
                  <button type="button" onClick={() => onSelect(i + 1)} className="hover:underline">
                    {etiqueta}
                  </button>
                ) : (
                  etiqueta
                )}
              </th>
            ))}
            <th className={`${celda} py-2 text-right text-ink`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={fila.label}
              className={`${fila.separa ? 'border-t border-line' : ''} ${fila.destaca ? 'font-bold text-ink' : ''}`}
            >
              <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-muted">{fila.label}</td>
              {fila.valores.map((v, i) => (
                <td
                  key={i}
                  className={`${celda} py-1.5 text-right tabular-nums ${
                    seleccionado === i + 1 ? 'bg-brand-red/5 font-semibold text-ink' : ''
                  }`}
                >
                  {fila.formato(v)}
                </td>
              ))}
              <td className={`${celda} py-1.5 text-right font-semibold tabular-nums text-ink`}>
                {fila.formato(fila.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
