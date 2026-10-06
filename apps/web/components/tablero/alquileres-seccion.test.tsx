import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AlquileresMes } from '@vacker/types';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

/** El filtro con el que se abrió la lista, para poder afirmarlo. */
const filtrosDeLaLista: unknown[] = [];
vi.mock('./detalle-drill-modal', () => ({
  DetalleDrillModal: ({ titulo, filtro }: { titulo: string; filtro: unknown }) => {
    filtrosDeLaLista.push(filtro);
    return <div data-testid="lista">{titulo}</div>;
  },
}));

const getAlquileresMensual = vi.fn();
vi.mock('../../lib/tablero-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/tablero-api')>();
  return {
    ...original,
    getAlquileresMensual: (...args: unknown[]) => getAlquileresMensual(...args),
  };
});

import { AlquileresSeccion } from './alquileres-seccion';

/**
 * Los alquileres de Vacker de enero a junio de 2026, tal como están en la base
 * al 25/09/2026: cantidad y comisión exactas, y la suma de valores
 * reconstruida del promedio de cada mes.
 *
 * Son los números reales a propósito: con ellos el cuadro tiene que dar lo
 * mismo que la planilla que Vacker manda — Q1 = 11 / 6.576 / 435 y
 * Q2 = 24 / 11.079 / 379. Si da otra cosa, el tablero y la planilla se
 * contradicen, que es lo que no puede pasar.
 */
const mes = (
  m: number,
  firmados: number,
  comision: number,
  valorMensualSuma: number,
): AlquileresMes => ({
  mes: m,
  firmados,
  comision,
  valorMensualSuma,
});
const VACKER_2026: AlquileresMes[] = [
  mes(1, 5, 4035, 2665),
  mes(2, 5, 2070, 1725),
  mes(3, 1, 471, 393),
  mes(4, 9, 2302, 2313),
  mes(5, 7, 3248, 2135),
  mes(6, 8, 5529, 4656),
  ...[7, 8, 9, 10, 11, 12].map((m) => mes(m, 0, 0, 0)),
];

/** Los valores de una fila del cuadro, por su etiqueta: los períodos y el Total. */
function fila(label: string) {
  const tabla = screen.getByRole('table', { name: 'Alquileres por período' });
  const celdas = within(
    within(tabla).getByRole('row', { name: new RegExp(`^${label}`) }),
  ).getAllByRole('cell');
  return celdas.slice(1).map((c) => c.textContent ?? '');
}

beforeEach(() => {
  getAlquileresMensual.mockReset();
  getAlquileresMensual.mockResolvedValue(VACKER_2026);
});

describe('Alquileres — la planilla de Vacker', () => {
  it('por trimestre da lo mismo que su Excel', async () => {
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    await userEvent.click(await screen.findByRole('button', { name: /Acumulado Trimestral/ }));

    expect(fila('Alquileres firmados').slice(0, 2)).toEqual(['11', '24']);
    expect(fila('Com. total USD').slice(0, 2)).toEqual(['$6.576', '$11.079']);
    expect(fila('Valor prom. alq. USD').slice(0, 2)).toEqual(['$435', '$379']);
  });

  /*
   * El total del valor promedio es el de los 35 alquileres (397), NO el
   * promedio de los dos trimestres que tienen datos (407). Un trimestre con 11
   * alquileres no puede pesar lo mismo que uno con 24.
   */
  it('el valor promedio del año es el de todos los alquileres, no el de los trimestres', async () => {
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    await userEvent.click(await screen.findByRole('button', { name: /Acumulado Trimestral/ }));

    expect(fila('Alquileres firmados').at(-1)).toBe('35');
    expect(fila('Com. total USD').at(-1)).toBe('$17.655');
    expect(fila('Valor prom. alq. USD').at(-1)).toBe('$397');
  });

  it('por mes muestra las doce columnas, con los meses del Excel', async () => {
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    await userEvent.click(await screen.findByRole('button', { name: /Acumulado del Mes/ }));

    const encabezados = within(screen.getByRole('table', { name: 'Alquileres por período' }))
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(encabezados).toEqual([
      'Métrica',
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
      'Total',
    ]);
    // Enero a junio, mes por mes, como en su gráfico «Alquileres firmados por mes».
    expect(fila('Alquileres firmados').slice(0, 6)).toEqual(['5', '5', '1', '9', '7', '8']);
  });

  it('el anual muestra las tres tarjetas del año', async () => {
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    expect(await screen.findByText('Año 2026')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('$17.655')).toBeInTheDocument();
    expect(screen.getByText('$397')).toBeInTheDocument();
  });

  it('elegir un mes en el cuadro muestra las tarjetas de ese mes', async () => {
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    await userEvent.click(await screen.findByRole('button', { name: /Acumulado del Mes/ }));
    await userEvent.click(
      within(screen.getByRole('table', { name: 'Alquileres por período' })).getByRole('button', {
        name: 'Abr',
      }),
    );
    expect(screen.getByText('Abril 2026')).toBeInTheDocument();
  });
});

describe('Alquileres — lo que no puede romper el tablero', () => {
  /*
   * Los minutos en que la web nueva ya salió y la API todavía no: el endpoint no
   * existe. Falla la sección, no la página.
   */
  it('si la API falla, avisa en la sección y no tira la pantalla', async () => {
    getAlquileresMensual.mockRejectedValue(new Error('404'));
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    expect(await screen.findByText(/No se pudieron cargar los alquileres/)).toBeInTheDocument();
  });

  it('sin alquileres en el año lo dice, en vez de dibujar un gráfico en cero', async () => {
    getAlquileresMensual.mockResolvedValue(
      VACKER_2026.map((m) => ({ ...m, firmados: 0, comision: 0, valorMensualSuma: 0 })),
    );
    render(<AlquileresSeccion anio={2025} mesSeleccionado={9} />);
    expect(
      await screen.findByText('Todavía no hay alquileres firmados en 2025.'),
    ).toBeInTheDocument();
  });
});

/**
 * Pedido de Vacker del 26/09/2026, ya con la sección en uso: «cuando hago
 * click en los alquileres firmados, que salga la ventana emergente mostrando
 * cuáles son».
 *
 * El filtro tiene que acotar EXACTAMENTE al período de la tarjeta. Si se le cae
 * el mes o el trimestre, la ventana trae los del año entero y la lista deja de
 * coincidir con el número sobre el que se hizo click.
 */
describe('Alquileres — ver cuáles son', () => {
  const tarjeta = () => screen.getByRole('button', { name: /Alquileres firmados/ });

  it('en el mensual, abre los de ESE mes', async () => {
    filtrosDeLaLista.length = 0;
    render(<AlquileresSeccion anio={2026} mesSeleccionado={9} />);
    await userEvent.click(await screen.findByRole('button', { name: /Acumulado del Mes/ }));
    await userEvent.click(
      within(screen.getByRole('table', { name: 'Alquileres por período' })).getByRole('button', {
        name: 'Abr',
      }),
    );

    await userEvent.click(tarjeta());
    expect(screen.getByTestId('lista')).toHaveTextContent('Alquileres firmados · Abril 2026');
    expect(filtrosDeLaLista.at(-1)).toEqual({
      anio: 2026,
      mes: 4,
      tipo: 'alquiler',
      estado: 'firmado',
      verTodo: true,
    });
  });

  it('en el trimestral, abre los de ESE trimestre', async () => {
    filtrosDeLaLista.length = 0;
    render(<AlquileresSeccion anio={2026} mesSeleccionado={5} />);
    await userEvent.click(await screen.findByRole('button', { name: /Acumulado Trimestral/ }));

    await userEvent.click(tarjeta());
    expect(screen.getByTestId('lista')).toHaveTextContent('Q2 2026');
    expect(filtrosDeLaLista.at(-1)).toEqual({
      anio: 2026,
      trimestre: 2,
      tipo: 'alquiler',
      estado: 'firmado',
      verTodo: true,
    });
  });

  it('en el anual, abre los del año', async () => {
    filtrosDeLaLista.length = 0;
    render(<AlquileresSeccion anio={2026} mesSeleccionado={5} />);
    await screen.findByText('Año 2026');

    await userEvent.click(tarjeta());
    expect(filtrosDeLaLista.at(-1)).toEqual({
      anio: 2026,
      tipo: 'alquiler',
      estado: 'firmado',
      verTodo: true,
    });
  });

  /*
   * Sin «Ver todo» la lista sale vacía: el listado filtra por puntas cuando el
   * alcance es «lo mío», y los alquileres no tienen. Es el mismo error que ya
   * tuvo la tarjeta de arriba del tablero.
   */
  it('pide la lista de toda la inmobiliaria, no «lo mío»', async () => {
    filtrosDeLaLista.length = 0;
    render(<AlquileresSeccion anio={2026} mesSeleccionado={5} />);
    await screen.findByText('Año 2026');
    await userEvent.click(tarjeta());
    expect(filtrosDeLaLista.at(-1)).toMatchObject({ verTodo: true });
  });
});
