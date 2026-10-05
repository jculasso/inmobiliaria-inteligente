import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ContratoResumenDto } from '@vacker/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ContratosLista } from './contratos-lista';

const c = (codigo: string, proximaIndexacion: string | null, importeVigente: number | null = 300_000): ContratoResumenDto => ({
  id: crypto.randomUUID(),
  codigo,
  estado: 'vigente',
  tipo: 'vivienda',
  moneda: 'ARS',
  inicio: '2026-01-01',
  fin: '2027-12-31',
  propiedad: { id: crypto.randomUUID(), direccion: `Calle ${codigo}`, unidad: null },
  propietarios: [],
  inquilinos: [{ id: crypto.randomUUID(), nombre: `Inquilino ${codigo}` }],
  importeVigente,
  proximaIndexacion,
});

describe('ContratosLista', () => {
  /*
   * Gexion muestra «Vencido» en la próxima indexación de seis contratos de
   * Vacker: es lo primero que hay que resolver cada mes.
   */
  it('marca la indexación vencida', () => {
    render(<ContratosLista contratos={[c('42', '2026-10-01'), c('43', '2027-01-01')]} hoy="2026-10-05" />);
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByText(/01\/10\/2026 · vencida/)).toBeInTheDocument();
    expect(tabla.queryByText(/01\/01\/2027 · vencida/)).not.toBeInTheDocument();
  });

  it('un contrato cuyo tramo de hoy no está indexado dice «A indexar», no $ 0', () => {
    render(<ContratosLista contratos={[c('44', '2026-09-01', null)]} hoy="2026-10-05" />);
    expect(within(screen.getByRole('table')).getByText('A indexar')).toBeInTheDocument();
  });
});
