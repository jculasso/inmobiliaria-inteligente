import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetalleDrillModal } from './detalle-drill-modal';

/**
 * El total del detalle tiene que dar lo mismo que el número del ranking.
 *
 * El ranking suma `punta.comision` — la parte de cada vendedor (`kpis.calc.ts`).
 * El detalle mostraba `comTotal`, la comisión COMPLETA de la operación, así que
 * en una venta compartida entre dos personas contaba también la punta del otro.
 *
 * Con datos reales de Alteva: el ranking decía 63.210 para Rocío Aguilar y el
 * detalle sumaba 251.430. Parte de la diferencia era el estado y el tipo (lo
 * arregla `vendedor-totales-table`); el resto era esto.
 */

const ROCIO = '11111111-1111-1111-1111-111111111111';
const OTRO = '22222222-2222-2222-2222-222222222222';

/** Una venta compartida: 10.000 en total, 6.000 de Rocío y 4.000 del otro. */
const COMPARTIDA = {
  id: 'op-1',
  codigo: 'OP-1001',
  tipo: 'venta',
  direccion: 'Córdoba 1234',
  precio: 200_000,
  valorMensual: null,
  moneda: 'USD',
  cantPuntas: 2,
  comTotal: 10_000,
  estado: 'escriturada',
  fechaReserva: null,
  fechaFirma: '2026-03-10',
  mes: 3,
  anio: 2026,
  obs: null,
  puntas: [
    { id: 'p1', lado: 'vendedora', usuarioId: ROCIO, nombre: 'Rocío Aguilar', comision: 6_000 },
    { id: 'p2', lado: 'compradora', usuarioId: OTRO, nombre: 'Otro', comision: 4_000 },
  ],
};

vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/tablero-api', () => ({
  listOperaciones: () => Promise.resolve([COMPARTIDA]),
}));

describe('DetalleDrillModal — la comisión de una venta compartida', () => {
  it('abierto desde un vendedor, muestra SU parte y no el total', async () => {
    render(
      <DetalleDrillModal
        titulo="Rocío Aguilar"
        filtro={{ anio: 2026, usuarioId: ROCIO } as never}
        onClose={() => {}}
      />,
    );

    // 6.000 es lo de Rocío; 10.000 sería la comisión entera de la operación.
    expect(await screen.findAllByText('$6.000')).not.toHaveLength(0);
    expect(screen.queryByText('$10.000')).not.toBeInTheDocument();
  });

  it('sin vendedor en el filtro, muestra la comisión completa', async () => {
    render(
      <DetalleDrillModal
        titulo="Todas"
        filtro={{ anio: 2026 } as never}
        onClose={() => {}}
      />,
    );

    expect(await screen.findAllByText('$10.000')).not.toHaveLength(0);
  });
});
