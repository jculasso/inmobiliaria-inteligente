import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PLANTILLA_ACCIONES, type ProtocoloDto } from '@vacker/types';
import { DetalleProtocolo } from './detalle-protocolo';

const updateAccion = vi.fn();
const updateProtocolo = vi.fn();

vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));
vi.mock('../../lib/protocolo-api', () => ({
  updateAccion: (...args: unknown[]) => updateAccion(...args),
  updateProtocolo: (...args: unknown[]) => updateProtocolo(...args),
  generarInformeProtocolo: vi.fn(),
}));

const BASE: ProtocoloDto = {
  id: 'p1',
  version: '2026-07-15T10:00:00.000Z',
  estado: 'activa',
  fechaInicio: '2026-07-01',
  semanaActual: 1,
  diasPublicada: 3,
  avance: 0,
  precioPublicado: 185000,
  moneda: 'USD',
  vencimientoAutorizacion: null,
  archivadoEn: null,
  motivoArchivo: null,
  agente: { id: 'u1', nombre: 'Ana', email: 'ana@vacker.com', telefono: null, fotoUrl: null },
  propiedad: {
    tasacionId: 't1',
    direccion: 'Córdoba 1234',
    barrio: null,
    ciudad: 'Rosario',
    tipoPropiedad: 'Departamento',
    tipoOperacion: 'venta',
    superficieTotal: 96,
    dormitorios: 2,
    banos: 1,
    valorRecomendado: 190000,
    // URL ya firmada: la respuesta de las mutaciones trae la key cruda.
    fotoUrl: 'https://storage/firmada?token=abc',
  },
  alertas: [],
  proximaAccion: null,
  propietarioNombre: 'Juan Pérez',
  propietarioTelefono: null,
  propietarioEmail: null,
  embudo: {
    consultas: 0,
    consultasCalificadas: 0,
    visitas: 0,
    interesadosActivos: 0,
    ofertas: 0,
    conversionVisita: 0,
    conversionOferta: 0,
  },
  devolucionesMercado: null,
  objeciones: null,
  recomendacion: null,
  decisionPropietario: null,
  proximasAcciones: null,
  observacionArchivo: null,
  acciones: PLANTILLA_ACCIONES.filter((a) => a.semana === 1).map((a, i) => ({
    id: `a${i}`,
    semana: 1,
    orden: i,
    clave: a.clave,
    titulo: a.titulo,
    estado: 'pendiente' as const,
    fechaPrevista: '2026-07-07',
    fechaRealizada: null,
    observaciones: null,
    resultado: null,
    evidencia: null,
  })),
};

beforeEach(() => {
  updateAccion.mockReset();
  updateProtocolo.mockReset();
});

describe('DetalleProtocolo — guardado optimista', () => {
  it('marca la acción al instante, sin esperar la respuesta de la API', async () => {
    const user = userEvent.setup();
    // La API nunca resuelve: si la UI dependiera de ella, el select no cambiaría.
    updateAccion.mockReturnValue(new Promise(() => {}));
    render(<DetalleProtocolo inicial={BASE} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0]!, 'realizada');

    expect(selects[0]).toHaveValue('realizada');
    expect(screen.getByRole('status')).toHaveTextContent('Guardando…');
  });

  it('revierte el cambio si la API falla y explica el error', async () => {
    const user = userEvent.setup();
    updateAccion.mockRejectedValue(new Error('La API no respondió.'));
    render(<DetalleProtocolo inicial={BASE} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0]!, 'realizada');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('La API no respondió.'));
    expect(selects[0]).toHaveValue('pendiente');
  });

  it('conserva la foto firmada cuando la respuesta trae la key cruda', async () => {
    const user = userEvent.setup();
    updateAccion.mockResolvedValue({
      ...BASE,
      propiedad: { ...BASE.propiedad, fotoUrl: 'tasador-fotos/t1/foto.jpg' },
    });
    render(<DetalleProtocolo inicial={BASE} />);

    await user.selectOptions(screen.getAllByRole('combobox')[0]!, 'realizada');

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByAltText('Córdoba 1234')).toHaveAttribute(
      'src',
      'https://storage/firmada?token=abc',
    );
  });

  it('los campos no se bloquean mientras guarda', async () => {
    const user = userEvent.setup();
    updateAccion.mockReturnValue(new Promise(() => {}));
    render(<DetalleProtocolo inicial={BASE} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0]!, 'en_proceso');

    // Con el guardado en vuelo, el resto del checklist sigue operable.
    expect(selects[1]).toBeEnabled();
  });

  it('una propiedad archivada queda en solo lectura', () => {
    render(<DetalleProtocolo inicial={{ ...BASE, estado: 'archivada' }} />);
    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
  });
});
