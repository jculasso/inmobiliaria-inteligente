import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResumenKpis } from '@vacker/types';
import { DashboardKpis } from './dashboard-kpis';

const filtrosDelDetalle: unknown[] = [];
const abiertoCon: { titulo: string; foco?: string; lado?: string }[] = [];
vi.mock('./detalle-drill-modal', () => ({
  DetalleDrillModal: ({
    titulo,
    filtro,
    foco,
    lado,
  }: {
    titulo: string;
    filtro: unknown;
    foco?: string;
    lado?: string;
  }) => {
    filtrosDelDetalle.push(filtro);
    abiertoCon.push({ titulo, foco, lado });
    return <div data-testid="detalle">{titulo}</div>;
  },
}));

const AGG = {
  volumen: 1000,
  operaciones: 2,
  puntas: 2,
  puntasCompradoras: 1,
  puntasVendedoras: 1,
  comision: 50,
  comisionCompradora: 20,
  comisionVendedora: 30,
  ticketPromedio: 500,
};
const RESUMEN: ResumenKpis = {
  anio: 2026,
  mes: 7,
  anual: AGG,
  mesActual: AGG,
  pendienteCobro: 0,
  operacionesSenadas: 0,
  alquileres: { firmados: 35, comision: 17655, valorMensualPromedio: 397 },
};

/**
 * La tarjeta «Alquileres firmados» de arriba del tablero.
 *
 * Tiene que seguir la MISMA regla que la sección Alquileres de más abajo. Si
 * no, la pantalla se contradice: la tarjeta en 0 y la sección en 35.
 */
describe('DashboardKpis — la tarjeta de alquileres', () => {
  it('quien ve los alquileres, ve la tarjeta', () => {
    render(<DashboardKpis resumen={RESUMEN} anio={2026} mes={7} verAlquileres />);
    expect(screen.getByText('Alquileres firmados · 2026')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  /*
   * Antes el vendedor recibía la tarjeta en 0, que parecía un error: «no hay
   * alquileres», cuando lo que pasaba es que no le corresponde verlos.
   */
  it('quien no los ve, no recibe una tarjeta en cero: no recibe la tarjeta', () => {
    render(<DashboardKpis resumen={RESUMEN} anio={2026} mes={7} verAlquileres={false} />);
    expect(screen.queryByText(/Alquileres firmados/)).not.toBeInTheDocument();
  });

  /*
   * El listado filtra por puntas cuando el alcance es «lo mío», y los
   * alquileres no tienen puntas. Un director sin tildar «Ver todo» veía 35 en
   * la tarjeta y la lista vacía al tocarla.
   */
  it('al tocarla, pide la lista de TODA la inmobiliaria aunque no esté tildado «Ver todo»', async () => {
    filtrosDelDetalle.length = 0;
    render(<DashboardKpis resumen={RESUMEN} anio={2026} mes={7} verTodo={false} verAlquileres />);
    await userEvent.click(screen.getByText('Alquileres firmados · 2026'));
    expect(filtrosDelDetalle.at(-1)).toEqual({
      anio: 2026,
      tipo: 'alquiler',
      estado: 'firmado',
      verTodo: true,
    });
  });
});

/*
 * Javier, 5/10/2026: «si te parás sobre comisión comprador o comisión vendedor
 * o sobre la comisión total trae cualquier cosa». Las ocho tarjetas abrían la
 * MISMA lista: todas las ventas del período, de cualquier estado. Cada una
 * tiene que abrir lo que ella cuenta.
 */
describe('DashboardKpis — cada tarjeta abre lo suyo', () => {
  const CASOS: [RegExp, { foco: string; lado?: string }][] = [
    [/^Volumen/, { foco: 'volumen' }],
    [/^Operaciones/, { foco: 'operaciones' }],
    [/^Ticket prom/, { foco: 'ticket' }],
    [/^Puntas compradoras/, { foco: 'puntas', lado: 'compradora' }],
    [/^Puntas vendedoras/, { foco: 'puntas', lado: 'vendedora' }],
    [/^Comisión:/, { foco: 'comision' }],
    [/^Com\. comprador/, { foco: 'comision', lado: 'compradora' }],
    [/^Com\. vendedor/, { foco: 'comision', lado: 'vendedora' }],
  ];

  for (const [tarjeta, esperado] of CASOS) {
    it(`${tarjeta.source.replace(/[\\^:]/g, '')}: escrituradas del mes, con su foco`, async () => {
      abiertoCon.length = 0;
      filtrosDelDetalle.length = 0;
      render(<DashboardKpis resumen={RESUMEN} anio={2026} mes={7} verAlquileres={false} />);
      // La primera fila es la del mes seleccionado.
      await userEvent.click(screen.getAllByRole('button', { name: tarjeta })[0]!);
      expect(filtrosDelDetalle.at(-1)).toEqual({
        anio: 2026,
        mes: 7,
        tipo: 'venta',
        estado: 'escriturada',
      });
      expect({
        foco: abiertoCon.at(-1)!.foco,
        ...(abiertoCon.at(-1)!.lado ? { lado: abiertoCon.at(-1)!.lado } : {}),
      }).toEqual(esperado);
    });
  }

  it('la fila del año abre el año entero, sin mes', async () => {
    filtrosDelDetalle.length = 0;
    render(<DashboardKpis resumen={RESUMEN} anio={2026} mes={7} verAlquileres={false} />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Com\. comprador/ })[1]!);
    expect(filtrosDelDetalle.at(-1)).toEqual({ anio: 2026, tipo: 'venta', estado: 'escriturada' });
  });
});
