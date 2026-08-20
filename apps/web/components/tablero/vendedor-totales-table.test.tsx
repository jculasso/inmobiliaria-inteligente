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
