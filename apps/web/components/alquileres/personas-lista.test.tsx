import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PersonaDto } from '@vacker/types';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
const crearPersona = vi.fn();
vi.mock('../../lib/alquileres-api', () => ({
  crearPersona: (...a: unknown[]) => crearPersona(...a),
  actualizarPersona: vi.fn(),
}));

import { PersonasLista, documentoLegible } from './personas-lista';

const persona = (
  nombre: string,
  documento: string | null,
  extra: Partial<PersonaDto> = {},
): PersonaDto => ({
  id: crypto.randomUUID(),
  tipo: 'fisica',
  nombre,
  documento,
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
  ...extra,
});

const PERSONAS = [
  persona('José Pérez', '20123456'),
  persona('Ana Gómez', '27333444555'),
  persona('Bruno Díaz', null),
];

/** La tabla de escritorio: las tarjetas del celular repiten los mismos datos. */
const tabla = () => within(screen.getByRole('table'));

beforeEach(() => {
  crearPersona.mockReset();
  refresh.mockReset();
});

describe('documentoLegible', () => {
  it('DNI con puntos, CUIT con guiones, y nada como raya', () => {
    expect(documentoLegible('20123456')).toBe('20.123.456');
    expect(documentoLegible('27333444555')).toBe('27-33344455-5');
    expect(documentoLegible(null)).toBe('—');
  });
});

describe('PersonasLista — buscar', () => {
  it('sin acentos ni mayúsculas: «perez» encuentra a «José Pérez»', async () => {
    render(<PersonasLista personas={PERSONAS} />);
    await userEvent.type(screen.getByRole('searchbox'), 'perez');
    expect(tabla().getByText('José Pérez')).toBeInTheDocument();
    expect(tabla().queryByText('Ana Gómez')).not.toBeInTheDocument();
  });

  it('el documento se encuentra escrito con o sin puntos', async () => {
    render(<PersonasLista personas={PERSONAS} />);
    await userEvent.type(screen.getByRole('searchbox'), '20.123.456');
    expect(tabla().getByText('José Pérez')).toBeInTheDocument();
    expect(tabla().getAllByRole('row')).toHaveLength(2); // encabezado + una persona
  });

  it('sin coincidencias lo dice, en vez de una tabla vacía', async () => {
    render(<PersonasLista personas={PERSONAS} />);
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText(/Nadie coincide con «zzz»/)).toBeInTheDocument();
  });

  it('sin personas cargadas, explica por dónde empezar', () => {
    render(<PersonasLista personas={[]} />);
    expect(screen.getByText(/Todavía no hay personas cargadas/)).toBeInTheDocument();
  });
});

describe('PersonasLista — alta', () => {
  it('da de alta con lo que se escribió y refresca la lista', async () => {
    crearPersona.mockResolvedValue(persona('Carla Ruiz', '30111222'));
    render(<PersonasLista personas={PERSONAS} />);
    await userEvent.click(screen.getByRole('button', { name: '＋ Nueva persona' }));
    const dialogo = within(screen.getByRole('dialog'));
    await userEvent.type(dialogo.getByLabelText(/Nombre y apellido/), 'Carla Ruiz');
    await userEvent.type(dialogo.getByLabelText(/^DNI/), '30.111.222');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar' }));
    expect(crearPersona).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ nombre: 'Carla Ruiz', documento: '30.111.222' }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  /*
   * La API rechaza el documento repetido nombrando a quien ya lo tiene. El
   * formulario tiene que mostrarlo y quedar abierto, no cerrarse en silencio.
   */
  it('si el documento ya existe, muestra el motivo y no cierra', async () => {
    crearPersona.mockRejectedValue(
      new Error('Ya hay una persona cargada con ese documento: José Pérez.'),
    );
    render(<PersonasLista personas={PERSONAS} />);
    await userEvent.click(screen.getByRole('button', { name: '＋ Nueva persona' }));
    const dialogo = within(screen.getByRole('dialog'));
    await userEvent.type(dialogo.getByLabelText(/Nombre y apellido/), 'Otro');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar' }));
    expect(await dialogo.findByRole('alert')).toHaveTextContent('José Pérez');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
