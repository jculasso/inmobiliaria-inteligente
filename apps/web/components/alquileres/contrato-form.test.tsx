import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PersonaDto, PropiedadAlquilerDto } from '@vacker/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
const crearContrato = vi.fn();
vi.mock('../../lib/alquileres-api', () => ({
  crearContrato: (...a: unknown[]) => crearContrato(...a),
  actualizarContrato: vi.fn(),
}));

import { ContratoForm } from './contrato-form';

const persona = (id: string, nombre: string): PersonaDto => ({
  id,
  tipo: 'fisica',
  nombre,
  documento: null,
  email: null,
  telefono: null,
  domicilio: null,
  obs: null,
  cuit: null,
  condicionIva: null,
  localidad: null,
  provincia: null,
  codigoPostal: null,
  fechaNacimiento: null,
  nacionalidad: null,
  estadoCivil: null,
});
const DUENO = persona('22222222-2222-4222-8222-222222222222', 'Dueño Uno');
const INQ = persona('33333333-3333-4333-8333-333333333333', 'Inquilina Dos');
const PROP: PropiedadAlquilerDto = { id: '11111111-1111-4111-8111-111111111111', direccion: 'Calle 123', unidad: '2° A', ciudad: 'Rosario', tipo: 'vivienda', obs: null };

beforeEach(() => {
  crearContrato.mockReset();
  push.mockReset();
});

async function completarPaso1() {
  await userEvent.selectOptions(screen.getByLabelText(/Propiedad/), PROP.id);
  await userEvent.selectOptions(screen.getByLabelText('Persona (propietario)'), DUENO.id);
  await userEvent.selectOptions(screen.getByLabelText('Persona (inquilino)'), INQ.id);
}

describe('ContratoForm — alta en tres pasos', () => {
  it('avisa lo que falta en cada paso, antes de guardar', () => {
    render(<ContratoForm personas={[DUENO, INQ]} propiedades={[PROP]} />);
    const falta = within(screen.getByLabelText('Lo que falta'));
    expect(falta.getByText(/Elegí la propiedad/)).toBeInTheDocument();
    expect(falta.getByText(/Falta el propietario/)).toBeInTheDocument();
    // Ningún paso se marca completo con el formulario vacío.
    expect(screen.queryByText('(completo)')).not.toBeInTheDocument();
  });

  it('del paso 1 al 3, genera los tramos y guarda en borrador', async () => {
    crearContrato.mockResolvedValue({ id: 'nuevo-id' });
    render(<ContratoForm personas={[DUENO, INQ]} propiedades={[PROP]} />);
    await completarPaso1();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    await userEvent.type(screen.getByLabelText(/Inicio/), '2024-11-01');
    await userEvent.type(screen.getByLabelText(/^Fin/), '2026-10-31');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));

    // Contrato como el #25 de Gexion: 4 meses → seis tramos.
    await userEvent.click(screen.getByRole('button', { name: 'Generar los tramos' }));
    expect(screen.getAllByLabelText(/Importe, tramo/)).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Guardar en borrador' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Importe, tramo 1'), '250000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en borrador' }));

    const dto = crearContrato.mock.calls[0]![1];
    expect(dto).toMatchObject({ propiedadId: PROP.id, inicio: '2024-11-01', fin: '2026-10-31', ajuste: 'indexado', indice: 'ICL' });
    expect(dto.tramos[0]).toEqual({ numero: 1, desde: '2024-11-01', hasta: '2025-02-28', importe: 250_000 });
    expect(dto.tramos[1].importe).toBeNull();
    expect(push).toHaveBeenCalledWith('/alquileres/contratos/nuevo-id');
  });

  // Regla 1, mientras se carga: el mismo mensaje que daría la API.
  it('un hueco entre tramos se avisa con sus fechas y no deja guardar', async () => {
    render(<ContratoForm personas={[DUENO, INQ]} propiedades={[PROP]} />);
    await completarPaso1();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await userEvent.type(screen.getByLabelText(/Inicio/), '2024-11-01');
    await userEvent.type(screen.getByLabelText(/^Fin/), '2026-10-31');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await userEvent.click(screen.getByRole('button', { name: 'Generar los tramos' }));
    await userEvent.type(screen.getByLabelText('Importe, tramo 1'), '250000');

    const desde2 = screen.getByLabelText('Desde, tramo 2');
    await userEvent.clear(desde2);
    await userEvent.type(desde2, '2025-03-15');

    expect(screen.getByText(/Del 01\/03\/2025 al 14\/03\/2025 no hay tramo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar en borrador' })).toBeDisabled();
  });

  it('si la API rechaza, muestra el motivo y no navega', async () => {
    crearContrato.mockRejectedValue(new Error('Ya hay un contrato con el código 25.'));
    render(<ContratoForm personas={[DUENO, INQ]} propiedades={[PROP]} />);
    await completarPaso1();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await userEvent.type(screen.getByLabelText(/Inicio/), '2026-01-01');
    await userEvent.type(screen.getByLabelText(/^Fin/), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await userEvent.click(screen.getByRole('button', { name: 'Generar los tramos' }));
    await userEvent.type(screen.getByLabelText('Importe, tramo 1'), '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en borrador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('código 25');
    expect(push).not.toHaveBeenCalled();
  });
});
