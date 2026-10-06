import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BoletaDto, CuentaServicioDto, PlanillaBoletasDto, PolizaDto } from '@vacker/types';

const cargarLoteBoletas = vi.fn();
const pagarBoleta = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  cargarLoteBoletas: (...a: unknown[]) => cargarLoteBoletas(...a),
  pagarBoleta: (...a: unknown[]) => pagarBoleta(...a),
  anularBoleta: vi.fn(),
  anularPoliza: vi.fn(),
  crearPoliza: vi.fn(),
  borrarCuentaServicio: vi.fn(),
  borrarServicio: vi.fn(),
  cargarServiciosSugeridos: vi.fn(),
  guardarCuentaServicio: vi.fn(),
  guardarServicio: vi.fn(),
}));

import { PlanillaBoletas } from './boletas-planilla';
import { ImpuestosVista } from './impuestos-vista';
import { EstadoPoliza } from './polizas';

const API = '33333333-3333-4333-8333-333333333333';
const EPE = '66666666-6666-4666-8666-666666666666';
const cuenta = (
  id: string,
  nombre: string,
  over: Partial<CuentaServicioDto> = {},
): CuentaServicioDto => ({
  id,
  propiedad: { id: 'p1', direccion: 'Mendoza 3340' },
  servicio: { id: `s-${id}`, nombre, clase: 'impuesto' },
  numeroCuenta: '12-345',
  aCargoDe: 'inquilino',
  paga: 'inmobiliaria',
  contrato: { id: 'c5', codigo: 'ALT-0005' },
  ...over,
});
const planilla: PlanillaBoletasDto = {
  periodo: '2026-11',
  filas: [
    {
      cuenta: cuenta(API, 'API'),
      cargadas: [],
      anterior: { cuota: '3/6', importe: 45_000, vencimiento: '2026-10-10' },
    },
    { cuenta: cuenta(EPE, 'EPE', { paga: 'inquilino' }), cargadas: [], anterior: null },
  ],
};
const boleta = (over: Partial<BoletaDto> = {}): BoletaDto => ({
  id: crypto.randomUUID(),
  nombre: 'API',
  clase: 'impuesto',
  cuentaId: API,
  polizaId: null,
  numeroCuenta: '12-345',
  propiedad: 'Mendoza 3340',
  contrato: { id: 'c5', codigo: 'ALT-0005' },
  periodo: '2026-11',
  cuota: '4/6',
  vencimiento: '2099-11-10',
  importe: 45_000,
  moneda: 'ARS',
  aCargoDe: 'inquilino',
  paga: 'inmobiliaria',
  estado: 'pendiente',
  pagadaEl: null,
  medio: null,
  registradoPor: 'Operador',
  aplicada: false,
  ...over,
});
const vista = (over: Partial<Parameters<typeof ImpuestosVista>[0]> = {}) =>
  render(
    <ImpuestosVista
      periodo="2026-11"
      ver="mes"
      planilla={planilla}
      boletas={[]}
      control={[]}
      servicios={[]}
      cuentas={[]}
      propiedades={[]}
      polizas={[]}
      contratos={[]}
      {...over}
    />,
  );

describe('Impuestos y servicios (entrega 19)', () => {
  it('«Copiar el mes anterior»: vencimiento un mes después y la cuota siguiente; guarda todo junto', async () => {
    cargarLoteBoletas.mockResolvedValueOnce({ creadas: 1, repetidas: 0, sinContrato: 0 });
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar el mes anterior/ }));
    expect(screen.getByLabelText('Cuota de API de Mendoza 3340')).toHaveValue('4/6');
    expect(screen.getByLabelText('Vencimiento de API de Mendoza 3340')).toHaveValue('2026-11-10');
    // La que no tenía mes anterior queda vacía.
    expect(screen.getByLabelText('Importe de EPE de Mendoza 3340')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cargarLoteBoletas).toHaveBeenCalledWith('token', {
        periodo: '2026-11',
        boletas: [{ cuentaId: API, cuota: '4/6', vencimiento: '2026-11-10', importe: 45_000 }],
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Se cargaron 1 boleta');
  });

  it('una fila con importe y sin vencimiento no se guarda: dice cuál', async () => {
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    fireEvent.change(screen.getByLabelText('Importe de EPE de Mendoza 3340'), {
      target: { value: '30.000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'EPE de Mendoza 3340: falta el vencimiento',
    );
    expect(cargarLoteBoletas).toHaveBeenCalledTimes(1);
  });

  it('la que paga la inmobiliaria se paga; la que paga una parte, se registra su comprobante', () => {
    vista({ boletas: [boleta(), boleta({ nombre: 'EPE', paga: 'inquilino' })] });
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByRole('button', { name: 'Pagar API' })).toBeInTheDocument();
    expect(
      tabla.getByRole('button', { name: 'Registrar el comprobante de EPE' }),
    ).toBeInTheDocument();
    expect(tabla.getByText('Falta comprobante')).toBeInTheDocument();
  });

  it('lo ya cobrado o liquidado no ofrece «Anular»', () => {
    vista({ boletas: [boleta({ aplicada: true })] });
    expect(
      within(screen.getByRole('table')).queryByRole('button', { name: 'Anular API' }),
    ).not.toBeInTheDocument();
  });

  it('registrar el pago manda fecha y medio', async () => {
    const b = boleta();
    vista({ boletas: [b] });
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Pagar API' }));
    fireEvent.change(screen.getByLabelText('Medio'), { target: { value: 'efectivo' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar el pago/ }));
    await waitFor(() =>
      expect(pagarBoleta).toHaveBeenCalledWith(
        'token',
        b.id,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        'efectivo',
      ),
    );
  });

  it('una póliza: vigente, por vencer en 60 días, vencida o anulada', () => {
    const p = (hasta: string, anulada = false) =>
      ({ id: crypto.randomUUID(), hasta, anulada }) as PolizaDto;
    const hoy = new Date(Date.now() - 3 * 3600 * 1000);
    const en = (dias: number) =>
      new Date(hoy.getTime() + dias * 86_400_000).toISOString().slice(0, 10);
    const { rerender } = render(<EstadoPoliza p={p(en(200))} />);
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    rerender(<EstadoPoliza p={p(en(30))} />);
    expect(screen.getByText(/^Vence el/)).toBeInTheDocument();
    rerender(<EstadoPoliza p={p(en(-1))} />);
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    rerender(<EstadoPoliza p={p(en(30), true)} />);
    expect(screen.getByText('Anulada')).toBeInTheDocument();
  });
});
