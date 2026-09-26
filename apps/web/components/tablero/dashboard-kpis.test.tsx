import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResumenKpis } from '@vacker/types';
import { DashboardKpis } from './dashboard-kpis';

const filtrosDelDetalle: unknown[] = [];
vi.mock('./detalle-drill-modal', () => ({
  DetalleDrillModal: ({ titulo, filtro }: { titulo: string; filtro: unknown }) => {
    filtrosDelDetalle.push(filtro);
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
    expect(filtrosDelDetalle.at(-1)).toEqual({ anio: 2026, tipo: 'alquiler', estado: 'firmado', verTodo: true });
  });
});
