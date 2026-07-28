import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LIMITE_LISTA, LIMITE_LISTA_CON_SONDA, type OperacionDto } from '@vacker/types';
import { OperacionesTable } from './operaciones-table';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
const deleteOperacion = vi.fn().mockResolvedValue({ id: '1' });
vi.mock('../../lib/tablero-api', () => ({
  deleteOperacion: (...args: unknown[]) => deleteOperacion(...args),
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

// El componente dibuja las mismas operaciones dos veces: tabla en pantalla
// ancha y tarjetas en el celular (cuál se ve lo decide el CSS, que jsdom no
// aplica). Los tests dicen explícitamente qué vista miran.
const enLaTabla = () => within(screen.getByRole('table'));
const enLasTarjetas = () => within(screen.getByRole('list', { name: 'Operaciones' }));

describe('OperacionesTable', () => {
  it('muestra las operaciones y el contador', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={true} />);
    expect(enLaTabla().getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(enLaTabla().getByText('Calle Falsa 123')).toBeInTheDocument();
    expect(screen.getByText('2 de 2 operaciones')).toBeInTheDocument();
  });

  it('en el celular cada operación es una tarjeta, sin tabla que deslizar', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={true} />);
    expect(enLasTarjetas().getAllByRole('listitem')).toHaveLength(2);
    expect(enLasTarjetas().getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    // El precio y la comisión se ven de una: antes había que deslizar a ciegas.
    expect(enLasTarjetas().getByText('$100.000')).toBeInTheDocument();
    expect(enLasTarjetas().getByText('$3.000')).toBeInTheDocument();
  });

  it('filtra por texto de búsqueda', async () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={true} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'Ana');
    expect(enLaTabla().getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.queryByText('Calle Falsa 123')).not.toBeInTheDocument();
  });

  // El vendedor y el team leader entran acá en modo lectura: ven sus
  // operaciones (las necesitan para sus KPIs) pero no las tocan. Se verifican
  // las TRES acciones, no solo el borrado: ocultar una y olvidar otra deja un
  // botón que promete algo que la API va a rechazar con un 403.
  it('sin permiso de escritura no hay alta, edición ni borrado', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={false} />);
    expect(screen.queryByRole('button', { name: /Nueva venta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Borrar/ })).not.toBeInTheDocument();
  });

  it('con permiso de escritura están las tres', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={true} />);
    expect(screen.getByRole('button', { name: /Nueva venta/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Editar/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Borrar/ }).length).toBeGreaterThan(0);
  });

  it('antes de borrar muestra qué operación es, para no equivocarse', async () => {
    // El implementador va a depurar ventas reales y el borrado es definitivo:
    // tiene que poder confirmar que está mirando la operación correcta.
    const user = userEvent.setup();
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={true} />);

    await user.click(enLaTabla().getAllByRole('button', { name: /Borrar/ })[0]!);

    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('Borrar venta')).toBeInTheDocument();
    expect(within(dialogo).getByText('OP-1001')).toBeInTheDocument();
    expect(within(dialogo).getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(within(dialogo).getByText('$100.000')).toBeInTheDocument();
    expect(within(dialogo).getByText('Ana')).toBeInTheDocument();
  });

  it('avisa cuando la lista quedó recortada, en vez de mostrar 500 en silencio', () => {
    // El tope existía desde siempre pero era MUDO: alguien con 1.240
    // operaciones veía 500 y decidía con datos incompletos sin enterarse.
    const muchas = Array.from({ length: LIMITE_LISTA_CON_SONDA }, (_, i) => ({
      ...OPERACIONES[0]!,
      id: `op-${i}`,
      codigo: `OP-${i}`,
    }));
    render(<OperacionesTable tipo="venta" operaciones={muchas} vendedores={[]} puedeEscribir={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(`Se están mostrando ${LIMITE_LISTA} ventas, y hay más`);
    // Y se muestra el tope exacto, no la fila de sonda.
    expect(enLaTabla().getAllByRole('row')).toHaveLength(LIMITE_LISTA + 1); // + encabezado
  });

  it('con pocas operaciones no avisa nada', () => {
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={false} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('borra recién cuando se confirma en el modal', async () => {
    const user = userEvent.setup();
    render(<OperacionesTable tipo="venta" operaciones={OPERACIONES} vendedores={[]} puedeEscribir={true} />);

    await user.click(enLaTabla().getAllByRole('button', { name: /Borrar/ })[0]!);
    expect(deleteOperacion).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, borrar' }));
    expect(deleteOperacion).toHaveBeenCalledWith('token', '1');
  });
});
