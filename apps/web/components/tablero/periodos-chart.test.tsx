import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PeriodosChart } from './periodos-chart';
import { fmtK, fmtNum } from '../../lib/format';
import { ABREV_MES } from '../../lib/meses';

/**
 * Los alquileres de Alteva por mes al 5/10/2026: la comisión llega a 4.900 en
 * septiembre. Con el eje en cuartos se leía $1k, $3k, $4k, $5k — sin el 2 — y
 * Javier vio la línea «arriba del punto que corresponde».
 */
const FIRMADOS = [2, 2, 0, 2, 2, 2, 2, 5, 5, 1, 0, 0];
const COMISION = [1550, 1880, 0, 1830, 1430, 1300, 1130, 3030, 4900, 870, 0, 0];

function dibujar() {
  render(
    <PeriodosChart
      titulo="Alquileres y comisión por mes"
      etiquetas={ABREV_MES}
      barras={FIRMADOS}
      linea={COMISION}
      formatoBarras={fmtNum}
      formatoLinea={(n) => `$${fmtK(n)}`}
      nombreBarras="Alquileres firmados"
      nombreLinea="Comisión USD"
      barrasEnteras
      seleccionado={9}
      onSelect={vi.fn()}
      pista="tocá una barra o un mes"
    />,
  );
  return within(screen.getByRole('img', { name: /Alquileres y comisión/ }));
}

describe('PeriodosChart — los ejes dicen la verdad', () => {
  it('el eje de la comisión marca cada mil, sin saltearse ninguno', () => {
    const grafico = dibujar();
    for (const etiqueta of ['$0', '$1k', '$2k', '$3k', '$4k', '$5k']) {
      expect(grafico.getByText(etiqueta)).toBeInTheDocument();
    }
  });

  it('el eje de los alquileres marca enteros', () => {
    const grafico = dibujar();
    for (const etiqueta of ['1', '2', '3', '4', '5']) expect(grafico.getByText(etiqueta)).toBeInTheDocument();
  });
});
