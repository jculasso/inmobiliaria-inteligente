import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResumenAcumulado } from './resumen-acumulado';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

const getResumenPeriodo = vi.fn().mockResolvedValue({
  agregado: {
    volumen: 1000,
    operaciones: 2,
    puntas: 2,
    puntasCompradoras: 1,
    puntasVendedoras: 1,
    comision: 50,
    ticketPromedio: 500,
  },
  ranking: [
    {
      usuarioId: 'a',
      nombre: 'Ana',
      volumen: 800,
      operaciones: 2,
      puntas: 2,
      puntasCompradoras: 1,
      puntasVendedoras: 1,
      ticketPromedio: 500,
      comision: 50,
      peso: 1,
    },
  ],
});
vi.mock('../../lib/tablero-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/tablero-api')>();
  return { ...actual, getResumenPeriodo: (...args: unknown[]) => getResumenPeriodo(...args) };
});

describe('ResumenAcumulado', () => {
  it('carga el tab Anual por default y muestra las métricas + totales por vendedor', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    expect(await screen.findByText('$1.000')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(getResumenPeriodo).toHaveBeenCalledWith('token', {
      anio: 2026,
      periodo: 'anual',
      mes: 7,
      trimestre: 3,
    });
  });

  it('al elegir Trimestral aparecen los sub-tabs Q1-Q4 y se puede cambiar de trimestre', async () => {
    render(<ResumenAcumulado anio={2026} mesSeleccionado={7} />);
    await screen.findByText('$1.000');

    await userEvent.click(screen.getByRole('button', { name: /Acumulado Trimestral/ }));
    expect(await screen.findByRole('button', { name: /Q1 · Ene–Mar/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Q1 · Ene–Mar/ }));
    expect(getResumenPeriodo).toHaveBeenLastCalledWith('token', {
      anio: 2026,
      periodo: 'trimestral',
      mes: 7,
      trimestre: 1,
    });
  });
});
