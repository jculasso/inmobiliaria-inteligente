import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CandidatoDto, PreparacionLiquidacionDto } from '@vacker/types';

const prepararLiquidacion = vi.fn();
const liquidar = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/abrir-pdf', () => ({ abrirPdfEnPestana: vi.fn() }));
vi.mock('../../lib/alquileres-api', () => ({
  prepararLiquidacion: (...a: unknown[]) => prepararLiquidacion(...a),
  liquidar: (...a: unknown[]) => liquidar(...a),
  generarLiquidacionPdf: vi.fn(),
}));

import { LiquidacionForm } from './liquidacion-form';

const DUENO = '11111111-1111-4111-8111-111111111111';
const REP = '33333333-3333-4333-8333-333333333333';
const c5 = { id: '55555555-5555-4555-8555-555555555555', codigo: 'ALT-0005', propiedad: 'Córdoba 1452 3° B', inquilinos: ['Ana Inquilina'] };
const propietarios: CandidatoDto[] = [{ persona: { id: DUENO, nombre: 'Juan Propietario' }, papel: 'propietario', contratos: [{ id: '55555555-5555-4555-8555-555555555555', codigo: 'ALT-0005', propiedad: 'Córdoba 1452 3° B' }], pendiente: [{ moneda: 'ARS', importe: 886_707.26 }] }];

/* Noviembre de 2026 del contrato #5, más una reparación a cargo del dueño. */
const prep = (over: Partial<PreparacionLiquidacionDto> = {}): PreparacionLiquidacionDto => ({
  persona: { id: DUENO, nombre: 'Juan Propietario' },
  moneda: 'ARS',
  fecha: '2026-11-12',
  aPagar: [{ conceptoId: '22222222-2222-4222-8222-222222222222', contrato: c5, tipo: 'alquiler', descripcion: 'Alquiler noviembre 2026', importe: 1_137_518 }],
  aDescontar: [
    { conceptoId: '44444444-4444-4444-8444-444444444444', contrato: c5, tipo: 'honorarios', descripcion: 'Honorarios noviembre 2026', importe: 110_111.74 },
    { conceptoId: REP, contrato: c5, tipo: 'reparacion', descripcion: 'Arreglo del aire', importe: 140_699 },
  ],
  enEspera: [{ conceptoId: '66666666-6666-4666-8666-666666666666', contrato: c5, tipo: 'alquiler', descripcion: 'Alquiler diciembre 2026', importe: 513_717.81 }],
  neto: 886_707.26,
  ...over,
});

describe('LiquidacionForm', () => {
  it('muestra lo cobrado, los descuentos, lo que espera y el neto', async () => {
    prepararLiquidacion.mockResolvedValue(prep());
    render(<LiquidacionForm propietarios={propietarios} personaInicial={DUENO} hoy="2026-11-12" />);
    expect((await screen.findByText('💰 Neto a pagar')).nextSibling).toHaveTextContent('$ 886.707,26');
    expect(screen.getByText('⏳ En espera: el inquilino todavía no pagó')).toBeInTheDocument();
  });

  // Pedido de Javier del 6/10/2026: cada propiedad dice qué es, quién la alquila y de quién es.
  it('agrupa por propiedad, con el inquilino y el propietario', async () => {
    prepararLiquidacion.mockResolvedValue(prep());
    render(<LiquidacionForm propietarios={propietarios} personaInicial={DUENO} hoy="2026-11-12" />);
    const propiedad = within(await screen.findByRole('region', { name: 'Propiedad Córdoba 1452 3° B' }));
    expect(propiedad.getByText('Ana Inquilina')).toBeInTheDocument();
    expect(propiedad.getByText('Propietario:').nextSibling).toHaveTextContent('Juan Propietario');
    expect(propiedad.getByRole('link', { name: 'Contrato ALT-0005' })).toHaveAttribute('href', `/alquileres/contratos/${c5.id}`);
    // Lo cobrado menos los dos descuentos.
    expect(propiedad.getByText('Subtotal de la propiedad').nextSibling).toHaveTextContent('$ 886.707,26');
  });

  // Dejar algo para después se le pregunta a la API, que sabe qué arrastra.
  it('destildar un descuento vuelve a preguntar con ese concepto excluido', async () => {
    prepararLiquidacion.mockResolvedValue(prep());
    render(<LiquidacionForm propietarios={propietarios} personaInicial={DUENO} hoy="2026-11-12" />);
    fireEvent.click(await screen.findByLabelText('Liquidar Arreglo del aire'));
    await waitFor(() => expect(prepararLiquidacion).toHaveBeenLastCalledWith('token', DUENO, 'ARS', '2026-11-12', [REP]));
  });

  // Regla 22: sin nada cobrado no se puede liquidar.
  it('sin nada cobrado a su favor, no deja liquidar', async () => {
    prepararLiquidacion.mockResolvedValue(prep({ aPagar: [], aDescontar: [], neto: 0 }));
    render(<LiquidacionForm propietarios={propietarios} personaInicial={DUENO} hoy="2026-11-12" />);
    expect(await screen.findByRole('button', { name: 'Liquidar' })).toBeDisabled();
  });

  it('liquida y ofrece el PDF', async () => {
    prepararLiquidacion.mockResolvedValue(prep());
    liquidar.mockResolvedValueOnce({ id: crypto.randomUUID(), numero: 3, persona: { id: DUENO, nombre: 'Juan Propietario' }, neto: 886_707.26, moneda: 'ARS' });
    render(<LiquidacionForm propietarios={propietarios} personaInicial={DUENO} hoy="2026-11-12" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Liquidar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Liquidación 000003 · $ 886.707,26 a Juan Propietario');
    expect(liquidar).toHaveBeenCalledWith('token', { personaId: DUENO, moneda: 'ARS', fecha: '2026-11-12', medio: 'transferencia', excluidos: [] });
    expect(screen.getByRole('button', { name: 'Descargar la liquidación' })).toBeInTheDocument();
  });
});
