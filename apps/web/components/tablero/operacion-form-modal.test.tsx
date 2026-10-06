import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperacionDto } from '@vacker/types';

vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
const createOperacion = vi.fn().mockResolvedValue({ id: 'nueva' });
const updateOperacion = vi.fn().mockResolvedValue({ id: '1' });
vi.mock('../../lib/tablero-api', () => ({
  createOperacion: (...a: unknown[]) => createOperacion(...a),
  updateOperacion: (...a: unknown[]) => updateOperacion(...a),
}));

const { OperacionFormModal } = await import('./operacion-form-modal');

const VENDEDORES = [{ id: 'u1', nombre: 'Ana' }] as never;

/**
 * Los importes de una operación se escriben como se escriben acá: «200.000»
 * es doscientos mil. El campo era `type=number` con `Number(texto) || 0`, y
 * esa misma cifra se guardaba como 200 (auditoría del 6/10/2026; Alquileres ya
 * lo había sufrido en el alta de contrato).
 */
describe('OperacionFormModal · importes', () => {
  beforeEach(() => {
    createOperacion.mockClear();
    updateOperacion.mockClear();
  });

  it('«200.000» se guarda como doscientos mil, y la comisión con coma decimal', async () => {
    const user = userEvent.setup();
    render(
      <OperacionFormModal
        tipo="venta"
        vendedores={VENDEDORES}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText('Calle y número, barrio'), 'Calle Falsa 123');
    await user.type(screen.getByRole('textbox', { name: 'Precio' }), '200.000');
    await user.selectOptions(screen.getAllByRole('combobox')[1]!, 'u1');
    await user.type(
      screen.getByRole('textbox', { name: 'Comisión de la punta vendedora' }),
      '6.000,50',
    );
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(createOperacion).toHaveBeenCalledTimes(1);
    const dto = createOperacion.mock.calls[0]![1];
    expect(dto.precio).toBe(200000);
    expect(dto.puntas).toEqual([{ lado: 'vendedora', usuarioId: 'u1', comision: 6000.5 }]);
  });

  it('lo que no es un importe frena el guardado con un aviso, en vez de guardar 0', async () => {
    const user = userEvent.setup();
    render(
      <OperacionFormModal
        tipo="alquiler"
        vendedores={VENDEDORES}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText('Calle y número, barrio'), 'Calle Falsa 123');
    await user.type(screen.getByRole('textbox', { name: 'Valor mensual' }), 'mil');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(createOperacion).not.toHaveBeenCalled();
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('«mil» no es un importe');
    expect(alerta).toHaveClass('text-danger');
  });

  it('al editar, el importe guardado se ve como se lee: «150.000,00»', () => {
    const op = {
      id: '1',
      codigo: 'OP-1',
      tipo: 'venta',
      direccion: 'Calle Falsa 123',
      precio: 150000,
      valorMensual: null,
      moneda: 'USD',
      cantPuntas: 0,
      comTotal: 0,
      estado: 'senada',
      fechaReserva: null,
      fechaFirma: null,
      anio: 2026,
      mes: 3,
      obs: null,
      puntas: [],
    } as OperacionDto;
    render(
      <OperacionFormModal
        tipo="venta"
        vendedores={VENDEDORES}
        operacion={op}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Precio' })).toHaveValue('150.000,00');
  });
});
