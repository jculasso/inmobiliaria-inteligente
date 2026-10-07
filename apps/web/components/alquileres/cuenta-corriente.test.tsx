import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CuentaCorrienteDto, PersonaDto, PersonaFichaDto } from '@vacker/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn() }));
vi.mock('../../lib/abrir-pdf', () => ({ abrirPdfEnPestana: vi.fn() }));
vi.mock('../../lib/alquileres-api', () => ({ anularCobro: vi.fn(), generarRecibo: vi.fn() }));

import { CuentaCorriente, detalleMovimiento } from './cuenta-corriente';

const id = () => crypto.randomUUID();
const cuenta = (saldo: number): CuentaCorrienteDto => ({
  persona: { id: id(), nombre: 'Romina Inquilina' },
  monedas: [
    {
      moneda: 'ARS',
      saldo,
      aVencer: 0,
      movimientos: [
        {
          id: id(),
          tipo: 'concepto',
          fecha: '2026-11-05',
          descripcion: 'Alquiler noviembre 2026',
          contrato: { id: id(), codigo: '5' },
          debe: 1_137_518,
          haber: 0,
          saldo: 1_137_518,
          anulado: false,
          numero: null,
        },
        {
          id: id(),
          tipo: 'cobro',
          fecha: '2026-11-06',
          descripcion: 'Cobro · recibo 9',
          contrato: null,
          debe: 0,
          haber: 999_999,
          saldo: 1_137_518,
          anulado: true,
          numero: 9,
        },
        {
          id: id(),
          tipo: 'cobro',
          fecha: '2026-11-07',
          descripcion: 'Cobro · recibo 10',
          contrato: null,
          debe: 0,
          haber: 1_000_000,
          saldo: 137_518,
          anulado: false,
          numero: 10,
        },
      ],
      pendientes: [
        {
          conceptoId: id(),
          contrato: { id: id(), codigo: '5' },
          descripcion: 'Alquiler noviembre 2026',
          sentido: 'a_cobrar',
          vencimiento: '2026-11-05',
          importe: 1_137_518,
          saldo: 137_518,
        },
      ],
      aFavor: [],
    },
  ],
});

describe('CuentaCorriente', () => {
  it('el saldo dicho en palabras: debe, a favor o al día', () => {
    const { rerender } = render(
      <CuentaCorriente cuenta={cuenta(137_518)} persona={null} cobros={[]} />,
    );
    expect(screen.getByText('Debe $ 137.518,00')).toBeInTheDocument();
    rerender(<CuentaCorriente cuenta={cuenta(-5_000)} persona={null} cobros={[]} />);
    expect(screen.getByText('A favor $ 5.000,00')).toBeInTheDocument();
    rerender(<CuentaCorriente cuenta={cuenta(0)} persona={null} cobros={[]} />);
    expect(screen.getByText('Al día')).toBeInTheDocument();
  });

  // Pasada de pruebas del 6/10/2026: «Debe» por una cuota que vence el mes que viene.
  it('aclara qué parte del saldo todavía no vence', () => {
    const c = cuenta(363_000);
    c.monedas[0]!.aVencer = 363_000;
    render(<CuentaCorriente cuenta={c} persona={null} cobros={[]} />);
    expect(screen.getByText('$ 363.000,00 todavía no vence')).toBeInTheDocument();
  });

  // Regla 24: el estado de cuenta cierra en el saldo.
  it('lo pendiente muestra lo que falta y cierra con el total del saldo', () => {
    render(<CuentaCorriente cuenta={cuenta(137_518)} persona={null} cobros={[]} />);
    const pendiente = screen.getByText(/Pendiente · estado de cuenta/).closest('section')!;
    expect(within(pendiente).getByText(/de \$ 1\.137\.518,00/)).toBeInTheDocument();
    expect(within(pendiente).getByText('Total').parentElement).toHaveTextContent('$ 137.518,00');
  });

  // Regla 19: lo anulado se ve, tachado.
  it('un cobro anulado queda tachado en los movimientos', () => {
    render(<CuentaCorriente cuenta={cuenta(137_518)} persona={null} cobros={[]} />);
    expect(screen.getByText(/Cobro · recibo 000009/).closest('td')).toHaveClass('line-through');
  });

  // Prueba en producción, 6/10/2026: «recibo 27» y «liquidación 19» con el
  // número pelado, cuando en el resto de la pantalla y en el PDF tiene seis cifras.
  it('los movimientos de cobros y liquidaciones llevan el número con seis cifras', () => {
    render(<CuentaCorriente cuenta={cuenta(137_518)} persona={null} cobros={[]} />);
    expect(screen.getByText(/Cobro · recibo 000010/)).toBeInTheDocument();
    expect(screen.queryByText(/recibo 10\b/)).not.toBeInTheDocument();
    expect(
      detalleMovimiento({ tipo: 'liquidacion', numero: 19, descripcion: 'Liquidación 19' }),
    ).toBe('Liquidación 000019');
    expect(
      detalleMovimiento({ tipo: 'concepto', numero: null, descripcion: 'Alquiler noviembre' }),
    ).toBe('Alquiler noviembre');
  });

  // Auditoría del 6/10/2026: el modal vivía dentro de la solapa «Cuenta» y «Editar datos» no hacía nada en las otras.
  it('«Editar datos» abre el formulario desde cualquier solapa', () => {
    const persona = {
      id: id(),
      nombre: 'Romina Inquilina',
      tipo: 'fisica',
      documento: null,
      telefono: null,
      email: null,
    } as unknown as PersonaDto;
    const ficha = {
      persona,
      cuentas: [],
      contactos: [],
      contratos: [],
      saldos: [],
    } as unknown as PersonaFichaDto;
    render(
      <CuentaCorriente
        cuenta={cuenta(0)}
        persona={persona}
        cobros={[]}
        ficha={ficha}
        historial={[]}
      />,
    );
    expect(screen.getByRole('button', { pressed: true })).not.toHaveTextContent(/cuenta/i);
    fireEvent.click(screen.getByRole('button', { name: /Editar datos/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
