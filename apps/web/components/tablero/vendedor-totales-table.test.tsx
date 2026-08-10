import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
