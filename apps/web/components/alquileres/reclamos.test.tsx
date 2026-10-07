import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProveedorDto, ReclamoDto } from '@vacker/types';

const cambiarReclamo = vi.fn();
const crearReclamo = vi.fn();
const avisarProveedor = vi.fn();
const cargarComprobante = vi.fn();
const VENDEDOR = '77777777-7777-4777-8777-777777777777';
const PLOMERO = '88888888-8888-4888-8888-888888888888';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/alquileres/reclamos',
}));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  cambiarReclamo: (...a: unknown[]) => cambiarReclamo(...a),
  crearReclamo: (...a: unknown[]) => crearReclamo(...a),
  avisarProveedor: (...a: unknown[]) => avisarProveedor(...a),
  cargarComprobante: (...a: unknown[]) => cargarComprobante(...a),
  listUsuariosAsignables: vi
    .fn()
    .mockResolvedValue([{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Lucía Operadora' }]),
  listProveedores: vi.fn().mockResolvedValue([
    {
      id: '88888888-8888-4888-8888-888888888888',
      nombre: 'Juan Plomero',
      rubro: 'plomero',
      telefono: '341 555-1234',
      email: 'juan@plomeria.com',
    },
  ]),
}));

import { ReclamoFicha as Ficha } from './reclamo-ficha';
import { ReclamosLista } from './reclamos-lista';
import { NuevoReclamoModal } from './reclamos-piezas';

const R: ReclamoDto = {
  id: '33333333-3333-4333-8333-333333333333',
  numero: 7,
  asunto: 'Pérdida de agua en el baño',
  tipo: 'mantenimiento',
  prioridad: 'alta',
  estado: 'abierto',
  contrato: {
    id: '55555555-5555-4555-8555-555555555555',
    codigo: 'ALT-0005',
    propiedad: 'Mendoza 3340',
  },
  persona: { id: '11111111-1111-4111-8111-111111111111', nombre: 'Ana Inquilina' },
  asignadoA: null,
  proveedor: null,
  abierto: '2026-10-06T12:00:00Z',
  actualizado: '2026-10-06T12:00:00Z',
  descripcion: 'Gotea la canilla de la ducha.',
  asignadoAId: null,
  abiertoPor: 'Javier',
  contactoLoSigue: null,
  inquilino: { nombre: 'Ana Inquilina', telefono: '341 444-0000' },
  gastos: [],
  totalGastos: [],
  notas: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      en: '2026-10-06T12:00:00Z',
      usuario: 'Javier',
      texto: 'Abrió el reclamo (alta prioridad).',
    },
  ],
};

const PROVEEDORES: ProveedorDto[] = [
  {
    id: PLOMERO,
    nombre: 'Juan Plomero',
    rubro: 'plomero',
    cuit: null,
    telefono: '341 555-1234',
    email: 'juan@plomeria.com',
    alias: null,
    cbu: null,
    obs: null,
    pendiente: 0,
    comprobantes: 0,
  },
];
/** La ficha con los proveedores del módulo, como la arma la página. */
const ReclamoFicha = ({ reclamo }: { reclamo: ReclamoDto }) => (
  <Ficha reclamo={reclamo} proveedores={PROVEEDORES} />
);

describe('Reclamos (entrega 15)', () => {
  it('la ficha muestra el contrato, quién lo abrió y el historial', () => {
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('link', { name: 'ALT-0005 · Mendoza 3340' })).toHaveAttribute(
      'href',
      '/alquileres/contratos/55555555-5555-4555-8555-555555555555',
    );
    expect(screen.getByText('Abrió el reclamo (alta prioridad).')).toBeInTheDocument();
  });

  // Un reclamo abierto a las 23 h de Argentina ya es «mañana» en UTC: la fecha sale del día argentino.
  it('abierto de noche, la fecha es la del día en Argentina', () => {
    render(<ReclamoFicha reclamo={{ ...R, abierto: '2026-10-07T02:00:00Z' }} />);
    expect(screen.getByText(/^06\/10\/2026/)).toBeInTheDocument();
  });

  it('sin notas, lo dice', () => {
    render(<ReclamoFicha reclamo={{ ...R, notas: [] }} />);
    expect(screen.getByText('Sin notas todavía.')).toBeInTheDocument();
  });

  // La fila de la tabla se abre con un clic, que el teclado no alcanza: el número es un link de verdad.
  it('en la lista, cada reclamo se abre también con el teclado', () => {
    const resumen = {
      id: R.id,
      numero: 7,
      asunto: R.asunto,
      tipo: R.tipo,
      prioridad: R.prioridad,
      estado: R.estado,
      contrato: R.contrato,
      persona: R.persona,
      asignadoA: null,
      proveedor: null,
      abierto: R.abierto,
      actualizado: R.actualizado,
    };
    render(<ReclamosLista reclamos={[resumen]} contratos={[]} estado="abiertos" />);
    expect(
      screen.getByRole('link', { name: 'Reclamo 7: Pérdida de agua en el baño' }),
    ).toHaveAttribute('href', `/alquileres/reclamos/${R.id}`);
    expect(screen.getByRole('button', { name: 'Abiertos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('guardar manda solo lo que cambió, con la nota', async () => {
    cambiarReclamo.mockResolvedValueOnce(R);
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'en_curso' } });
    fireEvent.change(screen.getByLabelText(/^Nota/), {
      target: { value: 'Va el plomero el jueves.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cambiarReclamo).toHaveBeenCalledWith('token', R.id, {
        estado: 'en_curso',
        nota: 'Va el plomero el jueves.',
      }),
    );
  });
});

// Javier, 7/10/2026: «los reclamos se los asignás a los vendedores, eso está mal».
describe('Reclamos · quién lo sigue y el proveedor (reglas 60 a 66)', () => {
  const PROVEEDOR = {
    id: PLOMERO,
    nombre: 'Juan Plomero',
    telefono: '341 555-1234',
    email: 'juan@plomeria.com',
  };

  it('regla 60: el reclamo nuevo pide «Lo sigue» y «Proveedor», y los manda', async () => {
    crearReclamo.mockResolvedValueOnce({ id: R.id });
    render(
      <NuevoReclamoModal
        contratos={[]}
        contratoFijo={R.contrato!.id}
        onClose={vi.fn()}
        onCreado={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Lo sigue')).toHaveDisplayValue('Sin asignar');
    expect(screen.getByLabelText('Proveedor')).toHaveDisplayValue('Sin proveedor');
    expect(screen.queryByText('Asignado a')).not.toBeInTheDocument();
    await screen.findByRole('option', { name: 'Juan Plomero' });
    fireEvent.change(screen.getByLabelText(/^Asunto/), { target: { value: 'Pérdida de agua' } });
    fireEvent.change(screen.getByLabelText('Lo sigue'), {
      target: { value: '44444444-4444-4444-8444-444444444444' },
    });
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: PLOMERO } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir el reclamo' }));
    await waitFor(() =>
      expect(crearReclamo).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          asignadoAId: '44444444-4444-4444-8444-444444444444',
          proveedorId: PLOMERO,
        }),
      ),
    );
  });

  it('regla 63: un reclamo de un vendedor muestra su nombre marcado, y guardar otra cosa no lo toca', async () => {
    cambiarReclamo.mockResolvedValue(R);
    render(<ReclamoFicha reclamo={{ ...R, asignadoAId: VENDEDOR, asignadoA: 'Pedro Vendedor' }} />);
    const loSigue = screen.getByLabelText('Lo sigue');
    await screen.findByRole('option', { name: 'Pedro Vendedor · no usa Alquileres' });
    expect(loSigue).toHaveDisplayValue('Pedro Vendedor · no usa Alquileres');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'en_curso' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cambiarReclamo).toHaveBeenLastCalledWith('token', R.id, {
        estado: 'en_curso',
        nota: null,
      }),
    );
    fireEvent.change(loSigue, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(cambiarReclamo).toHaveBeenLastCalledWith(
        'token',
        R.id,
        expect.objectContaining({ asignadoAId: null }),
      ),
    );
  });

  it('regla 66: la ficha muestra el proveedor con su teléfono y su email para llamarlo', () => {
    render(<ReclamoFicha reclamo={{ ...R, proveedor: PROVEEDOR }} />);
    expect(screen.getByRole('link', { name: /341 555-1234/ })).toHaveAttribute(
      'href',
      'tel:3415551234',
    );
    expect(screen.getByRole('link', { name: /juan@plomeria.com/ })).toHaveAttribute(
      'href',
      'mailto:juan@plomeria.com',
    );
  });

  it('regla 66: la lista muestra el proveedor y «Sin proveedor», en la tabla y en las tarjetas', () => {
    const resumen = (id: string, proveedor: typeof PROVEEDOR | null) => ({
      ...R,
      id,
      proveedor,
    });
    render(
      <ReclamosLista
        reclamos={[resumen(R.id, PROVEEDOR), resumen('99999999-9999-4999-8999-999999999999', null)]}
        contratos={[]}
        estado="abiertos"
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Proveedor' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Lo sigue' })).toBeInTheDocument();
    expect(screen.getAllByText('Juan Plomero')).toHaveLength(2);
    expect(screen.getAllByText('Sin proveedor')).toHaveLength(2);
  });
});

// Javier, 7/10/2026: «como está no sirve». Reglas 67 a 73.
describe('Reclamos · el circuito del reclamo (reglas 67 a 73)', () => {
  const PROVEEDOR = {
    id: PLOMERO,
    nombre: 'Juan Plomero',
    telefono: '341 555-1234',
    email: 'juan@plomeria.com',
  };

  it('regla 67: el estado se elige entre Abierto, En curso y Resuelto; «Cerrado» no está', () => {
    render(<ReclamoFicha reclamo={R} />);
    const opciones = within(screen.getByLabelText('Estado'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opciones).toEqual(['Abierto', 'En curso', 'Resuelto']);
  });

  it('regla 69: arriba de la ficha la prioridad dice «Prioridad alta», no «Alta»', () => {
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByText('Prioridad alta')).toBeInTheDocument();
    // «Alta» sola queda solo como opción del select de Prioridad, que ya tiene su rótulo.
    expect(screen.queryByText(/^Alta$/, { ignore: 'option, script, style' })).toBeNull();
  });

  it('regla 70: «Cargar el gasto del arreglo» abre el formulario con el proveedor y el contrato del reclamo', async () => {
    cargarComprobante.mockResolvedValueOnce({});
    render(<ReclamoFicha reclamo={{ ...R, proveedor: PROVEEDOR }} />);
    fireEvent.click(screen.getByRole('button', { name: /Cargar el gasto del arreglo/ }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByLabelText(/^Proveedor/)).toHaveValue(PLOMERO);
    // El contrato es el del reclamo, fijo: no se elige.
    expect(dialogo.getByText('ALT-0005 · Mendoza 3340')).toBeInTheDocument();
    fireEvent.change(dialogo.getByLabelText(/Qué se hizo/), {
      target: { value: 'Cambio de flexible' },
    });
    fireEvent.change(dialogo.getByLabelText(/Importe/), { target: { value: '85.000' } });
    fireEvent.click(dialogo.getByRole('button', { name: 'Cargar' }));
    await waitFor(() =>
      expect(cargarComprobante).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          reclamoId: R.id,
          proveedorId: PLOMERO,
          contratoId: R.contrato!.id,
          importe: 85_000,
        }),
      ),
    );
  });

  it('regla 70: sin proveedor en el reclamo, el gasto se carga igual y el proveedor se elige ahí', async () => {
    cargarComprobante.mockResolvedValueOnce({});
    render(<ReclamoFicha reclamo={R} />);
    fireEvent.click(screen.getByRole('button', { name: /Cargar el gasto del arreglo/ }));
    const dialogo = within(screen.getByRole('dialog'));
    const proveedor = dialogo.getByLabelText(/^Proveedor/);
    expect(proveedor).toHaveDisplayValue('Elegí el proveedor…');
    fireEvent.change(dialogo.getByLabelText(/Qué se hizo/), { target: { value: 'Pintura' } });
    fireEvent.change(dialogo.getByLabelText(/Importe/), { target: { value: '1.000' } });
    fireEvent.click(dialogo.getByRole('button', { name: 'Cargar' }));
    expect(await dialogo.findByRole('alert')).toHaveTextContent('Elegí el proveedor.');
    fireEvent.change(proveedor, { target: { value: PLOMERO } });
    fireEvent.click(dialogo.getByRole('button', { name: 'Cargar' }));
    await waitFor(() =>
      expect(cargarComprobante).toHaveBeenLastCalledWith(
        'token',
        expect.objectContaining({ reclamoId: R.id, proveedorId: PLOMERO }),
      ),
    );
  });

  it('regla 71: «Gastos del arreglo» lista fecha, proveedor, importe, a cargo de quién y estado, con el total', () => {
    render(
      <ReclamoFicha
        reclamo={{
          ...R,
          gastos: [
            {
              id: '99999999-9999-4999-8999-999999999999',
              fecha: '2026-10-07',
              proveedor: 'Juan Plomero',
              descripcion: 'Cambio de flexible',
              importe: 85_000,
              moneda: 'ARS',
              aCargoDe: 'propietario',
              estado: 'pendiente',
            },
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              fecha: '2026-10-08',
              proveedor: 'Juan Plomero',
              descripcion: 'Error de carga',
              importe: 10_000,
              moneda: 'ARS',
              aCargoDe: 'inquilino',
              estado: 'anulado',
            },
          ],
          totalGastos: [{ moneda: 'ARS', importe: 85_000 }],
        }}
      />,
    );
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Fecha',
      'Proveedor',
      'Qué se hizo',
      'A cargo de',
      'Importe',
      'Estado',
    ]);
    expect(tabla.getByText('07/10/2026')).toBeInTheDocument();
    expect(tabla.getByText('Propietario')).toBeInTheDocument();
    expect(tabla.getByText('A pagar')).toBeInTheDocument();
    expect(tabla.getByText('Anulado')).toBeInTheDocument();
    // En el celular, tarjetas.
    expect(screen.getByRole('list', { name: 'Gastos del arreglo' })).toBeInTheDocument();
    expect(screen.getByText('Total del arreglo').parentElement).toHaveTextContent('$ 85.000,00');
  });

  it('regla 71: sin gastos, lo dice', () => {
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByText('Todavía no se cargó ningún gasto del arreglo.')).toBeInTheDocument();
  });

  it('regla 73: «Avisar al proveedor» abre el mail redactado y no manda nada hasta «Enviar»', async () => {
    avisarProveedor.mockResolvedValueOnce({ enviado: true, para: ['juan@plomeria.com'] });
    render(
      <ReclamoFicha
        reclamo={{
          ...R,
          proveedor: PROVEEDOR,
          asignadoA: 'Lucía Operadora',
          contactoLoSigue: { telefono: null, email: 'lucia@alteva.com' },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Avisar al proveedor/ }));
    expect(avisarProveedor).not.toHaveBeenCalled();
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByLabelText(/^Asunto/)).toHaveValue(
      'Reclamo 7 · Pérdida de agua en el baño · Mendoza 3340',
    );
    const mail = dialogo.getByLabelText(/^Mail/) as HTMLTextAreaElement;
    expect(mail.value).toContain('Mendoza 3340');
    expect(mail.value).toContain('Gotea la canilla de la ducha.');
    expect(mail.value).toContain('Prioridad alta.');
    expect(mail.value).toContain('Inquilino: Ana Inquilina · tel. 341 444-0000');
    expect(mail.value).toContain('lo sigue Lucía Operadora (lucia@alteva.com)');
    // El tilde, marcado por defecto, saca el teléfono.
    const tilde = dialogo.getByLabelText('Incluir el teléfono del inquilino');
    expect(tilde).toBeChecked();
    fireEvent.click(tilde);
    expect(mail.value).toContain('Inquilino: Ana Inquilina\n');
    expect(mail.value).not.toContain('341 444-0000');
    fireEvent.click(dialogo.getByRole('button', { name: /Enviar/ }));
    await waitFor(() =>
      expect(avisarProveedor).toHaveBeenCalledWith('token', R.id, {
        asunto: 'Reclamo 7 · Pérdida de agua en el baño · Mendoza 3340',
        cuerpo: expect.not.stringContaining('341 444-0000'),
      }),
    );
    expect(await dialogo.findByRole('status')).toHaveTextContent(
      'Enviado a Juan Plomero (juan@plomeria.com)',
    );
  });

  it('regla 73: si el proveedor no tiene email, el botón explica dónde cargarlo en vez de fallar', () => {
    render(<ReclamoFicha reclamo={{ ...R, proveedor: { ...PROVEEDOR, email: null } }} />);
    expect(screen.getByRole('button', { name: /Avisar al proveedor/ })).toBeDisabled();
    expect(screen.getByText(/Cargale un email al proveedor en/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gastos › Proveedores' })).toHaveAttribute(
      'href',
      '/alquileres/proveedores',
    );
  });

  it('regla 73: sin proveedor, el botón dice que primero hay que elegirlo', () => {
    render(<ReclamoFicha reclamo={R} />);
    expect(screen.getByRole('button', { name: /Avisar al proveedor/ })).toBeDisabled();
    expect(screen.getByText(/Elegí el proveedor en «Actualizar»/)).toBeInTheDocument();
  });
});
