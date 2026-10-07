import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ContratoDto, PlantillaDto } from '@vacker/types';

const generarDesdePlantilla = vi.fn();
const descargarArchivo = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  generarDesdePlantilla: (...a: unknown[]) => generarDesdePlantilla(...a),
}));
vi.mock('../../lib/descargar-archivo', () => ({
  descargarArchivo: (...a: unknown[]) => descargarArchivo(...a),
}));

import { GenerarContrato } from './generar-contrato';

const contrato = {
  id: '55555555-5555-4555-8555-555555555555',
  tipo: 'vivienda',
  estado: 'vigente',
} as ContratoDto;
const plantilla = (over: Partial<PlantillaDto>): PlantillaDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Locación vivienda',
  tipoContrato: null,
  formato: 'word',
  nombreArchivo: 'Contrato.docx',
  tamano: 1000,
  actualizada: '2026-10-07T12:00:00Z',
  ...over,
});

describe('GenerarContrato', () => {
  beforeEach(() => vi.clearAllMocks());

  it('descarga el contrato en Word con el nombre que manda la API', async () => {
    const blob = new Blob(['PK']);
    generarDesdePlantilla.mockResolvedValueOnce({ blob, nombre: 'Contrato-ALT-0011.docx' });
    render(<GenerarContrato contrato={contrato} plantillas={[plantilla({})]} />);
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Descargar el contrato en Word' }));
    await waitFor(() =>
      expect(descargarArchivo).toHaveBeenCalledWith(blob, 'Contrato-ALT-0011.docx'),
    );
    expect(generarDesdePlantilla).toHaveBeenCalledWith(
      'token',
      contrato.id,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText(/subilo abajo, en «Documento y firma»/)).toBeInTheDocument();
  });

  it('ya no ofrece vista previa ni PDF', () => {
    render(<GenerarContrato contrato={contrato} plantillas={[plantilla({})]} />);
    expect(screen.queryByRole('button', { name: /Vista previa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PDF/ })).not.toBeInTheDocument();
  });

  it('solo ofrece las de Word que sirven para este tipo de contrato', () => {
    render(
      <GenerarContrato
        contrato={contrato}
        plantillas={[
          plantilla({ id: 'a', nombre: 'Comercial', tipoContrato: 'comercial' }),
          plantilla({ id: 'b', nombre: 'Vieja de texto', formato: 'texto' }),
          plantilla({ id: 'c', nombre: 'Particular', tipoContrato: 'vivienda' }),
        ]}
      />,
    );
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Particular']);
  });

  it('sin plantillas de Word, invita a subir una', () => {
    render(<GenerarContrato contrato={contrato} plantillas={[plantilla({ formato: 'texto' })]} />);
    expect(screen.getByRole('link', { name: 'Subir una' })).toHaveAttribute(
      'href',
      '/alquileres/plantillas',
    );
  });

  it('el error de la API se ve', async () => {
    generarDesdePlantilla.mockRejectedValueOnce(new Error('La plantilla no existe.'));
    render(<GenerarContrato contrato={contrato} plantillas={[plantilla({})]} />);
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Descargar el contrato en Word' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La plantilla no existe.');
  });
});
