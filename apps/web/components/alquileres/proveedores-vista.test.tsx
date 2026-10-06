import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComprobanteDto, ContratoResumenDto, GastosReporteDto, ProveedorDto } from '@vacker/types';

const cargarComprobante = vi.fn();
const pagarComprobante = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/alquileres/proveedores' }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/alquileres-api', () => ({
  cargarComprobante: (...a: unknown[]) => cargarComprobante(...a),
  pagarComprobante: (...a: unknown[]) => pagarComprobante(...a),
  anularComprobante: vi.fn(),
  borrarProveedor: vi.fn(),
  guardarProveedor: vi.fn(),
}));

import { ProveedoresVista } from './proveedores-vista';

const P1 = '11111111-1111-4111-8111-111111111111';
const C1 = '22222222-2222-4222-8222-222222222222';
const proveedores: ProveedorDto[] = [
  { id: P1, nombre: 'Plomería Centro', rubro: 'plomero', cuit: null, telefono: null, email: null, alias: null, cbu: null, obs: null, pendiente: 85_000, comprobantes: 1 },
];
const comp = (over: Partial<ComprobanteDto>): ComprobanteDto => ({
  id: crypto.randomUUID(),
  proveedor: { id: P1, nombre: 'Plomería Centro', rubro: 'plomero' },
  contrato: { id: C1, codigo: 'ALT-0003', propiedad: 'Calle 1' },
  fecha: '2026-10-02',
  tipoComprobante: 'factura_c',
  numero: null,
  descripcion: 'Cambio de flexible',
  importe: 85_000,
  moneda: 'ARS',
  aCargoDe: 'propietario',
  estado: 'pendiente',
  pagadoEl: null,
  medio: null,
  registradoPor: 'Operador',
  aplicado: false,
  ...over,
});
const reporte: GastosReporteDto = {
  anio: 2026,
  porRubro: [{ rubro: 'plomero', importe: 85_000, cantidad: 1 }],
  porACargo: [{ aCargoDe: 'propietario', importe: 85_000 }],
  porMes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 85_000, 0, 0],
  pendiente: 85_000,
};
const contratos = [{ id: C1, codigo: 'ALT-0003', estado: 'vigente', propiedad: { direccion: 'Calle 1', unidad: null } }] as ContratoResumenDto[];

describe('ProveedoresVista', () => {
  it('los gastos del año y lo que falta pagar', () => {
    render(<ProveedoresVista proveedores={proveedores} comprobantes={[comp({})]} reporte={reporte} contratos={contratos} estado="pendientes" />);
    expect(screen.getByText('A pagar a proveedores').closest('.rounded-brand')).toHaveTextContent('$ 85.000');
    expect(screen.getByText('A cargo de propietarios').closest('.rounded-brand')).toHaveTextContent('$ 85.000');
  });

  it('lo ya cobrado o liquidado no se puede anular, pero sí pagar', () => {
    render(<ProveedoresVista proveedores={proveedores} comprobantes={[comp({ aplicado: true })]} reporte={reporte} contratos={contratos} estado="pendientes" />);
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByRole('button', { name: /Pagar a/ })).toBeInTheDocument();
    expect(tabla.queryByRole('button', { name: 'Anular el comprobante' })).not.toBeInTheDocument();
  });

  it('cargarlo al propietario exige el contrato', async () => {
    render(<ProveedoresVista proveedores={proveedores} comprobantes={[]} reporte={reporte} contratos={contratos} estado="pendientes" />);
    fireEvent.click(screen.getByRole('button', { name: /Cargar comprobante/ }));
    fireEvent.change(screen.getByLabelText(/Qué se hizo/), { target: { value: 'Cambio de flexible' } });
    fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: '85.000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('elegí el contrato');
    fireEvent.change(screen.getByLabelText(/Contrato/), { target: { value: C1 } });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar' }));
    await waitFor(() => expect(cargarComprobante).toHaveBeenCalledWith('token', expect.objectContaining({ contratoId: C1, importe: 85_000, aCargoDe: 'propietario' })));
  });

  it('un gasto de la inmobiliaria no pide contrato', async () => {
    render(<ProveedoresVista proveedores={proveedores} comprobantes={[]} reporte={reporte} contratos={contratos} estado="pendientes" />);
    fireEvent.click(screen.getByRole('button', { name: /Cargar comprobante/ }));
    fireEvent.change(screen.getByLabelText(/A cargo de/), { target: { value: 'inmobiliaria' } });
    expect(screen.queryByLabelText(/Contrato/)).not.toBeInTheDocument();
  });

  it('pagar registra fecha y medio', async () => {
    const c = comp({});
    render(<ProveedoresVista proveedores={proveedores} comprobantes={[c]} reporte={reporte} contratos={contratos} estado="pendientes" />);
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /Pagar a/ }));
    fireEvent.change(screen.getByLabelText('Medio'), { target: { value: 'efectivo' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar el pago/ }));
    await waitFor(() => expect(pagarComprobante).toHaveBeenCalledWith('token', c.id, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'efectivo'));
  });
});
