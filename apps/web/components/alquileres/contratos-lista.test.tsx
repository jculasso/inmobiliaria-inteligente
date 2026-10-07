import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ContratoResumenDto } from '@vacker/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn() }));
vi.mock('../../lib/alquileres-api', () => ({
  borrarContrato: vi.fn(),
  anularContrato: vi.fn(),
  getContrato: vi.fn(),
  actualizarDatosContrato: vi.fn(),
}));

import { ContratosLista } from './contratos-lista';

const c = (
  codigo: string,
  proximaIndexacion: string | null,
  importeVigente: number | null = 300_000,
): ContratoResumenDto => ({
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
  proximaIndexacionEspera: false,
});

describe('ContratosLista', () => {
  /*
   * Gexion muestra «Vencido» en la próxima indexación de seis contratos de
   * Vacker: es lo primero que hay que resolver cada mes.
   */
  it('marca la indexación vencida', () => {
    render(
      <ContratosLista
        contratos={[c('42', '2026-10-01'), c('43', '2027-01-01')]}
        hoy="2026-10-05"
      />,
    );
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByText(/01\/10\/2026 · vencida/)).toBeInTheDocument();
    expect(tabla.queryByText(/01\/01\/2027 · vencida/)).not.toBeInTheDocument();
  });

  // Regla 7, visto en Alteva el 7/10/2026: ALT-0005 esperaba el IPC de septiembre y figuraba «vencida».
  it('si ya empezó pero el índice no salió, dice que espera el índice, no «vencida»', () => {
    render(
      <ContratosLista
        contratos={[{ ...c('45', '2026-10-01'), proximaIndexacionEspera: true }]}
        hoy="2026-10-07"
      />,
    );
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByText(/01\/10\/2026 · espera el índice/)).toBeInTheDocument();
    expect(tabla.queryByText(/vencida/)).not.toBeInTheDocument();
  });

  it('un contrato cuyo tramo de hoy no está indexado dice «A indexar», no $ 0', () => {
    render(<ContratosLista contratos={[c('44', '2026-09-01', null)]} hoy="2026-10-05" />);
    expect(within(screen.getByRole('table')).getByText('A indexar')).toBeInTheDocument();
  });

  // Decidido con Javier el 6/10/2026: lápiz y papelera en cada fila; lo que tiene historia se anula.
  it('borrador: editar y borrar; vigente: editar y anular; anulado: nada', () => {
    const borrador = { ...c('ALT-0001', null), estado: 'borrador' as const };
    const vigente = c('ALT-0002', null);
    const anulado = { ...c('ALT-0003', null), estado: 'anulado' as const };
    render(<ContratosLista contratos={[borrador, vigente, anulado]} hoy="2026-10-05" />);
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByRole('button', { name: 'Borrar el contrato ALT-0001' })).toBeInTheDocument();
    expect(tabla.getByRole('button', { name: 'Anular el contrato ALT-0002' })).toBeInTheDocument();
    expect(tabla.getByRole('button', { name: 'Editar el contrato ALT-0002' })).toBeInTheDocument();
    expect(tabla.queryByRole('button', { name: /el contrato ALT-0003/ })).not.toBeInTheDocument();
  });

  it('la papelera de un vigente pide el motivo', () => {
    render(<ContratosLista contratos={[c('ALT-0002', null)]} hoy="2026-10-05" />);
    fireEvent.click(
      within(screen.getByRole('table')).getByRole('button', {
        name: 'Anular el contrato ALT-0002',
      }),
    );
    expect(within(screen.getByRole('dialog')).getByText('Motivo')).toBeInTheDocument();
  });

  // Un botón dentro de otro es HTML inválido: React no hidrata y la tarjeta del teléfono se rompe.
  it('en el teléfono, las acciones no quedan dentro del botón de la tarjeta', () => {
    const { container } = render(
      <ContratosLista
        contratos={[c('ALT-0002', null), { ...c('ALT-0001', null), estado: 'borrador' as const }]}
        hoy="2026-10-05"
      />,
    );
    expect(container.querySelectorAll('button button')).toHaveLength(0);
  });
});
