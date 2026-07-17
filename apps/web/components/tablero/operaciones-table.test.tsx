import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperacionDto } from '@vacker/types';
import { OperacionesTable } from './operaciones-table';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/tablero-api', () => ({
  deleteOperacion: vi.fn().mockResolvedValue({ id: '1' }),
}));

const OPERACIONES: OperacionDto[] = [
  {
    id: '1',
    codigo: 'OP-1001',
    tipo: 'venta',
    direccion: 'Av. Siempre Viva 742',
    precio: 100000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 1,
    comTotal: 3000,
    estado: 'escriturada',
    fechaReserva: null,
    fechaFirma: '2026-03-10',
    anio: 2026,
    mes: 3,
    obs: null,
    puntas: [{ id: 'p1', lado: 'vendedora', usuarioId: 'u1', nombre: 'Ana', comision: 3000 }],
  },
  {
    id: '2',
    codigo: 'OP-1002',
    tipo: 'venta',
    direccion: 'Calle Falsa 123',
    precio: 80000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 1,
    comTotal: 2000,
    estado: 'senada',
    fechaReserva: '2026-04-01',
    fechaFirma: null,
    anio: 2026,
    mes: 4,
    obs: null,
    puntas: [{ id: 'p2', lado: 'compradora', usuarioId: 'u2', nombre: 'Beto', comision: 2000 }],
  },
];

describe('OperacionesTable', () => {
  it('muestra las operaciones y el contador', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeBorrar={true} />);
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
    expect(screen.getByText('2 de 2 operaciones')).toBeInTheDocument();
  });

  it('filtra por texto de búsqueda', async () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeBorrar={true} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'Ana');
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.queryByText('Calle Falsa 123')).not.toBeInTheDocument();
  });

  it('oculta el botón de borrar cuando puedeBorrar es false', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeBorrar={false} />);
    expect(screen.queryByLabelText('Borrar')).not.toBeInTheDocument();
  });
});
