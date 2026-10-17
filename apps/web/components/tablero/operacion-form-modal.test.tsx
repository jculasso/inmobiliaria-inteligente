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

/**
 * El guardado manda las puntas como el set completo. Para que la API pueda
 * rechazar un formulario que no vio todas —el que borró la punta de otro
 * vendedor (revisión de seguridad del 17/10/2026)—, viajan también los ids de
 * las puntas con las que se abrió.
 */
describe('OperacionFormModal · puntas vistas', () => {
  const VENDEDORES_DOS = [
    { id: 'u1', nombre: 'Ana' },
    { id: 'u2', nombre: 'Beto' },
  ] as never;

  const compartida = {
    id: '1',
    codigo: 'OP-1',
    tipo: 'venta',
    direccion: 'Calle Falsa 123',
    precio: 150000,
    valorMensual: null,
    moneda: 'USD',
    cantPuntas: 2,
    comTotal: 8000,
    estado: 'escriturada',
    fechaReserva: null,
    fechaFirma: '2026-05-10',
    anio: 2026,
    mes: 5,
    obs: null,
    puntas: [
      { id: 'p1', lado: 'vendedora', usuarioId: 'u1', nombre: 'Ana', comision: 5000 },
      { id: 'p2', lado: 'compradora', usuarioId: 'u2', nombre: 'Beto', comision: 3000 },
    ],
  } as OperacionDto;

  beforeEach(() => updateOperacion.mockClear());

  it('al editar una venta, manda como vistas las puntas con las que se abrió', async () => {
    const user = userEvent.setup();
    render(
      <OperacionFormModal
        tipo="venta"
        vendedores={VENDEDORES_DOS}
        operacion={compartida}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const dto = updateOperacion.mock.calls[0]![2];
    expect(dto.puntasVistas).toEqual(['p1', 'p2']);
    expect(dto.puntas).toHaveLength(2);
  });

  it('quitar una punta a propósito: no viaja en `puntas`, pero sí en las vistas', async () => {
    const user = userEvent.setup();
    render(
      <OperacionFormModal
        tipo="venta"
        vendedores={VENDEDORES_DOS}
        operacion={compartida}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByDisplayValue('Beto'), '');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const dto = updateOperacion.mock.calls[0]![2];
    expect(dto.puntas).toEqual([{ lado: 'vendedora', usuarioId: 'u1', comision: 5000 }]);
    expect(dto.puntasVistas).toEqual(['p1', 'p2']);
  });

  it('un alquiler no tiene puntas: no manda ninguna de las dos', async () => {
    const user = userEvent.setup();
    const alquiler = {
      ...compartida,
      tipo: 'alquiler',
      precio: null,
      valorMensual: 900,
      estado: 'firmado',
      puntas: [],
    } as OperacionDto;
    render(
      <OperacionFormModal
        tipo="alquiler"
        vendedores={VENDEDORES_DOS}
        operacion={alquiler}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const dto = updateOperacion.mock.calls[0]![2];
    expect(dto).not.toHaveProperty('puntas');
    expect(dto).not.toHaveProperty('puntasVistas');
  });
});
