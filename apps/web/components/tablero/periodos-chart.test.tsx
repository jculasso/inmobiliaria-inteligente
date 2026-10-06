import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeriodosChart } from './periodos-chart';
import { fmtK, fmtNum } from '../../lib/format';
import { ABREV_MES } from '../../lib/meses';

/** Los alquileres de Alteva por mes al 5/10/2026. */
const FIRMADOS = [2, 2, 0, 2, 2, 2, 2, 5, 5, 1, 0, 0];
const COMISION = [1550, 1880, 0, 1830, 1430, 1300, 1130, 3030, 4900, 870, 0, 0];

function dibujar(transcurridos?: number, onSelect = vi.fn()) {
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
      onSelect={onSelect}
      pista="tocá una barra o un mes"
      transcurridos={transcurridos}
    />,
  );
  return screen.getByRole('img', { name: /Alquileres y comisión/ });
}

/*
 * Javier, 5/10/2026, tres veces: «el gráfico se sigue viendo mal». Era un
 * gráfico de doble eje —barras y una línea con su propia escala encima— y la
 * línea no tenía relación visual con las barras. Ahora son dos paneles, cada
 * uno contra su eje. Lo que esto protege es que no vuelva la línea.
 */
describe('PeriodosChart — dos paneles, sin línea encima', () => {
  it('cada magnitud tiene su panel con título', () => {
    const grafico = within(dibujar());
    expect(grafico.getByText('Alquileres firmados')).toBeInTheDocument();
    expect(grafico.getByText('Comisión USD')).toBeInTheDocument();
  });

  it('no hay línea ni puntos superpuestos a las barras', () => {
    expect(dibujar().querySelectorAll('polyline, circle')).toHaveLength(0);
  });

  it('una barra por mes en cada panel', () => {
    expect(dibujar().querySelectorAll('rect')).toHaveLength(24);
  });

  it('tocar la barra de la comisión también elige el mes', async () => {
    const onSelect = vi.fn();
    const barras = dibujar(undefined, onSelect).querySelectorAll('rect');
    await userEvent.click(barras[12 + 7]!); // agosto, en el panel de abajo
    expect(onSelect).toHaveBeenCalledWith(8);
  });
});

describe('PeriodosChart — los ejes dicen la verdad', () => {
  /*
   * Con el eje en cuartos de 5.000 se leía $1k, $3k, $4k, $5k — sin el 2 —
   * porque `fmtK` redondeaba 2.500 a «3k». Ver `marcasDelEje`.
   */
  it('las marcas de la comisión son valores exactos', () => {
    const grafico = within(dibujar());
    for (const etiqueta of ['$0', '$2k', '$4k', '$6k'])
      expect(grafico.getByText(etiqueta)).toBeInTheDocument();
  });

  it('el eje de los alquileres marca enteros', () => {
    const grafico = within(dibujar());
    for (const etiqueta of ['1', '2', '3', '4', '5'])
      expect(grafico.getByText(etiqueta)).toBeInTheDocument();
  });
});

/*
 * Con noviembre y diciembre en cero el gráfico parecía mostrar un negocio que
 * se frenó. Los meses que no llegaron no se dibujan.
 */
describe('PeriodosChart — los meses que no llegaron', () => {
  it('en octubre, las barras terminan en octubre en los dos paneles', () => {
    expect(dibujar(10).querySelectorAll('rect')).toHaveLength(20);
  });

  it('las etiquetas de los doce meses siguen, para poder elegirlos', () => {
    const grafico = within(dibujar(10));
    expect(grafico.getByText('Nov')).toBeInTheDocument();
    expect(grafico.getByText('Dic')).toBeInTheDocument();
  });
});
