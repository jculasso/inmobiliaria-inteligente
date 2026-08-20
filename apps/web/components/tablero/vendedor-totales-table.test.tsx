import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { VendedorTotalesTable } from './vendedor-totales-table';

/**
 * Al abrir el detalle de un vendedor, el alcance tiene que viajar con el filtro.
 *
 * El backend INTERSECTA el filtro por vendedor con el alcance de vista
 * (`operaciones.service.ts`): pedir las operaciones de otra persona sin el
 * alcance devuelve una lista vacía, no un error. El síntoma era un modal en
 * blanco al hacer clic en cualquiera del ranking que no fuera uno mismo.
 *
 * La guardia general (`lib/alcance-en-pantallas.test.ts`) NO cubre esto: mira
 * que el archivo mencione `verTodo`, y acá lo menciona igual en las props. Hace
 * falta comprobar el valor que efectivamente le llega al modal.
 */

const filtrosRecibidos: unknown[] = [];

vi.mock('./detalle-drill-modal', () => ({
  DetalleDrillModal: ({ filtro }: { filtro: unknown }) => {
    filtrosRecibidos.push(filtro);
    return <div data-testid="modal" />;
  },
}));

const ITEMS = [
  {
    usuarioId: 'u-otro',
    nombre: 'Otra Persona',
    fotoUrl: null,
    volumen: 500_000,
    comision: 15_000,
    puntas: 3,
    operaciones: 2,
    peso: 1,
  },
];

/** El nombre del vendedor es un botón: es lo que abre el detalle. */
function abrirDetalle() {
  fireEvent.click(screen.getAllByRole('button', { name: /Otra Persona/ })[0]!);
}

describe('VendedorTotalesTable — el detalle hereda el alcance', () => {
  it('pasa verTodo al modal cuando la pantalla lo tiene activo', async () => {
    filtrosRecibidos.length = 0;
    render(<VendedorTotalesTable items={ITEMS as never} anio={2026} verTodo />);

    abrirDetalle();

    expect(filtrosRecibidos[0]).toMatchObject({
      anio: 2026,
      usuarioId: 'u-otro',
      verTodo: true,
    });
  });

  it('el detalle se acota a lo mismo que compone el ranking', () => {
    /*
     * El ranking se arma con `ventas(tx, anio, 'escriturada')`: solo ventas, y
     * solo escrituradas. El detalle tiene que pedir EXACTAMENTE eso o los dos
     * números no cierran.
     *
     * Con datos reales de Alteva, Rocío Aguilar: el ranking contaba 12
     * operaciones y el detalle traía 30 — seis alquileres y doce ventas en
     * otros estados que el ranking nunca había sumado.
     */
    filtrosRecibidos.length = 0;
    render(<VendedorTotalesTable items={ITEMS as never} anio={2026} verTodo />);

    abrirDetalle();

    expect(filtrosRecibidos[0]).toMatchObject({ tipo: 'venta', estado: 'escriturada' });
  });

  it('sin el check activo, el detalle no pide un alcance más amplio', async () => {
    filtrosRecibidos.length = 0;
    render(<VendedorTotalesTable items={ITEMS as never} anio={2026} />);

    abrirDetalle();

    // Lo que importa es que NO viaje en `true`; que la clave esté presente con
    // `undefined` o ausente da igual, porque el cliente omite los `undefined`.
    expect((filtrosRecibidos[0] as { verTodo?: boolean }).verTodo).toBeFalsy();
  });
});

/**
 * El ordenamiento se elige en pantalla.
 *
 * Vacker pidió que fuera por volumen —que es como ya estaba— pero el criterio
 * no es el mismo para todas: una mira el volumen, otra la comisión, que es lo
 * que efectivamente entra, y otra las puntas, que miden actividad.
 *
 * Los tres vendedores de abajo están armados para que cada criterio dé un orden
 * DISTINTO. Con datos donde el que más factura es también el que más cobra, un
 * test así pasa sin comprobar nada.
 */
const TRES = [
  // Mucho volumen, poca comisión, pocas puntas, ticket enorme.
  { usuarioId: 'u-1', nombre: 'Ana Volumen', fotoUrl: null, volumen: 900_000, comision: 5_000, puntas: 2, ticketPromedio: 450_000, operaciones: 2, peso: 0.6 },
  // Volumen medio, la comisión más alta, ticket chico.
  { usuarioId: 'u-2', nombre: 'Beto Comisión', fotoUrl: null, volumen: 400_000, comision: 30_000, puntas: 5, ticketPromedio: 80_000, operaciones: 4, peso: 0.27 },
  // El que menos factura, pero el que más puntas hizo.
  { usuarioId: 'u-3', nombre: 'Caro Puntas', fotoUrl: null, volumen: 200_000, comision: 12_000, puntas: 9, ticketPromedio: 22_222, operaciones: 8, peso: 0.13 },
];

/** El orden en que quedan los vendedores en la tabla de escritorio. */
function ordenEnPantalla() {
  return screen
    .getAllByRole('row')
    .map((f) => f.textContent ?? '')
    .map((t) => ['Ana Volumen', 'Beto Comisión', 'Caro Puntas'].find((n) => t.includes(n)))
    .filter(Boolean);
}

describe('VendedorTotalesTable — por qué columna se ordena', () => {
  it('arranca por volumen, que es lo que pidió Vacker', () => {
    render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    expect(ordenEnPantalla()).toEqual(['Ana Volumen', 'Beto Comisión', 'Caro Puntas']);
  });

  for (const [criterio, esperado] of [
    ['Comisión', ['Beto Comisión', 'Caro Puntas', 'Ana Volumen']],
    ['Puntas', ['Caro Puntas', 'Beto Comisión', 'Ana Volumen']],
    ['Ticket prom.', ['Ana Volumen', 'Beto Comisión', 'Caro Puntas']],
  ] as const) {
    it(`al elegir ${criterio}, la tabla se reordena por esa columna`, () => {
      render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
      fireEvent.click(screen.getAllByRole('button', { name: criterio })[0]!);
      expect(ordenEnPantalla()).toEqual([...esperado]);
    });
  }

  it('la medalla la lleva el primero del criterio elegido, no el de más volumen', () => {
    // Si la medalla quedara fija en el de más volumen, la tabla diría una cosa
    // y el ícono otra.
    render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Puntas' })[0]!);
    const primera = screen.getAllByRole('row')[1]!;
    expect(primera.textContent).toContain('Caro Puntas');
    expect(primera.textContent).toContain('🥇');
  });

  it('el encabezado marca por cuál columna se está ordenando', () => {
    // Ordenada por comisión, los volúmenes se ven desordenados: sin la marca
    // en el encabezado eso parece un error de la tabla.
    render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Comisión' })[0]!);
    const marcadas = screen
      .getAllByRole('columnheader')
      .filter((c) => c.getAttribute('aria-sort') === 'descending');
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]!.textContent).toContain('Comisión');
  });

  it('cada tabla ordena por su cuenta', () => {
    // El Ranking y el Resumen acumulado son dos instancias del mismo
    // componente. Cambiar el orden en una no puede mover la otra.
    //
    // Las consultas van acotadas con `within` a cada contenedor: los dos
    // `render` dibujan sobre el MISMO documento, así que `getAllByRole` suelto
    // devuelve las filas de las dos tablas juntas. La primera versión de este
    // test fallaba por eso y no por el componente.
    const a = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    const b = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    fireEvent.click(within(a.container).getAllByRole('button', { name: 'Puntas' })[0]!);

    const primero = (contenedor: HTMLElement) =>
      within(contenedor)
        .getAllByRole('row')
        .map((f) => f.textContent ?? '')
        .map((t) => ['Ana Volumen', 'Beto Comisión', 'Caro Puntas'].find((n) => t.includes(n)))
        .filter(Boolean)[0];

    expect(primero(a.container)).toBe('Caro Puntas');
    expect(primero(b.container), 'la segunda tabla se movió sola').toBe('Ana Volumen');
  });
});

/**
 * El peso acompaña al criterio elegido.
 *
 * Antes era siempre la participación en el VOLUMEN, ordenara la tabla por lo
 * que ordenase: con la tabla por comisión, la barra contaba una cosa y la
 * columna que mandaba, otra.
 *
 * Los tres vendedores de `TRES` sirven igual acá: tienen 900/400/200 de
 * volumen, 5.000/30.000/12.000 de comisión y 2/5/9 puntas, así que cada
 * criterio da porcentajes distintos y ninguno se puede confundir con otro.
 */
describe('VendedorTotalesTable — el peso sigue al criterio', () => {
  /**
   * Los porcentajes de la columna de peso, en el orden en que se muestran.
   *
   * Se lee la ÚLTIMA CELDA de cada fila y no el texto de la fila entera: al
   * concatenar celdas, «$22.222» y «13%» quedan pegados como «$22.22213%» y
   * cualquier expresión regular termina leyendo 22213. Pasó.
   */
  function pesosEnPantalla(contenedor: HTMLElement) {
    return within(contenedor)
      .getAllByRole('row')
      .slice(1, -1) // sin el encabezado ni la fila de TOTAL GENERAL
      .map((f) => f.querySelectorAll('td'))
      .filter((celdas) => celdas.length > 0)
      .map((celdas) => Number(celdas[celdas.length - 1]!.textContent?.match(/(\d+)%/)?.[1]))
      .filter((n) => Number.isFinite(n));
  }

  it('por volumen, es la participación en el volumen', () => {
    // 900.000 de 1.500.000 = 60%; 400.000 = 27%; 200.000 = 13%.
    const { container } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    expect(pesosEnPantalla(container)).toEqual([60, 27, 13]);
  });

  it('por comisión, es la participación en la comisión', () => {
    // 30.000 de 47.000 = 64%; 12.000 = 26%; 5.000 = 11%.
    const { container } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    fireEvent.click(within(container).getAllByRole('button', { name: 'Comisión' })[0]!);
    expect(pesosEnPantalla(container)).toEqual([64, 26, 11]);
  });

  it('por puntas, es la participación en las puntas', () => {
    // 9 de 16 = 56%; 5 = 31%; 2 = 13%.
    const { container } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    fireEvent.click(within(container).getAllByRole('button', { name: 'Puntas' })[0]!);
    expect(pesosEnPantalla(container)).toEqual([56, 31, 13]);
  });

  it('los tres criterios que se suman dan porcentajes que cierran en 100', () => {
    for (const criterio of ['Volumen', 'Comisión', 'Puntas']) {
      const { container, unmount } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
      fireEvent.click(within(container).getAllByRole('button', { name: criterio })[0]!);
      const suma = pesosEnPantalla(container).reduce((a, b) => a + b, 0);
      // 99..101 por el redondeo de cada fila a un entero.
      expect(suma, `los pesos por ${criterio} suman ${suma}`).toBeGreaterThanOrEqual(99);
      expect(suma, `los pesos por ${criterio} suman ${suma}`).toBeLessThanOrEqual(101);
      unmount();
    }
  });

  it('por ticket promedio NO es una participación, sino la comparación con el equipo', () => {
    /*
     * Un promedio no se suma. El ticket del equipo es el volumen total sobre
     * las puntas totales: 1.500.000 / 16 = 93.750.
     *
     * Ana factura 450.000 por punta → 480% del ticket de la casa. Si esto
     * fuera una participación sobre la suma de los tickets, daría 81% y no
     * significaría nada.
     */
    const { container } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    fireEvent.click(within(container).getAllByRole('button', { name: 'Ticket prom.' })[0]!);
    expect(pesosEnPantalla(container)[0]).toBe(480);
  });

  it('la columna cambia de nombre cuando deja de ser una parte de un total', () => {
    const { container } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    const ultima = () => within(container).getAllByRole('columnheader').at(-1)!.textContent;
    expect(ultima()).toBe('Peso');
    fireEvent.click(within(container).getAllByRole('button', { name: 'Ticket prom.' })[0]!);
    expect(ultima()).toBe('vs. equipo');
  });

  it('por volumen da lo mismo que el peso que calcula el servidor', () => {
    // Si se separaran, la tabla y cualquier otro lugar que muestre el peso del
    // servidor dirían números distintos para lo mismo.
    const { container } = render(<VendedorTotalesTable items={TRES as never} anio={2026} />);
    const delServidor = [...TRES]
      .sort((a, b) => b.volumen - a.volumen)
      .map((i) => Math.round(i.peso * 100));
    expect(pesosEnPantalla(container)).toEqual(delServidor);
  });
});
