import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PlantillaDto } from '@vacker/types';

const subirPlantilla = vi.fn();
const descargarPlantilla = vi.fn();
const descargarEjemploPlantilla = vi.fn();
const descargarArchivo = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  subirPlantilla: (...a: unknown[]) => subirPlantilla(...a),
  descargarPlantilla: (...a: unknown[]) => descargarPlantilla(...a),
  descargarEjemploPlantilla: (...a: unknown[]) => descargarEjemploPlantilla(...a),
  reemplazarArchivoPlantilla: vi.fn(),
  editarPlantilla: vi.fn(),
  borrarPlantilla: vi.fn(),
}));
vi.mock('../../lib/descargar-archivo', () => ({
  descargarArchivo: (...a: unknown[]) => descargarArchivo(...a),
}));

import { PlantillasVista } from './plantillas-vista';

const WORD: PlantillaDto = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Locación vivienda',
  tipoContrato: 'vivienda',
  formato: 'word',
  nombreArchivo: 'Contrato Alteva.docx',
  tamano: 20_000,
  actualizada: '2026-10-07T12:00:00Z',
};
const TEXTO: PlantillaDto = {
  ...WORD,
  id: '22222222-2222-4222-8222-222222222222',
  nombre: 'La vieja',
  formato: 'texto',
  nombreArchivo: null,
  tamano: null,
};

const docx = (nombre = 'Contrato.docx') =>
  new File(['PK'], nombre, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

function abrirSubida() {
  fireEvent.click(screen.getByRole('button', { name: '＋ Subir plantilla (Word)' }));
}

describe('PlantillasVista', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista cada plantilla con su archivo, y avisa la de texto anterior', () => {
    render(<PlantillasVista plantillas={[WORD, TEXTO]} />);
    expect(screen.getByText(/Contrato Alteva\.docx/)).toBeInTheDocument();
    expect(
      screen.getByText('Plantilla de texto anterior: subí la versión en Word.'),
    ).toBeInTheDocument();
    // La de texto no se descarga: no tiene Word.
    expect(screen.getAllByRole('button', { name: '⬇️ Descargar' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '🔁 Subir el Word' })).toBeInTheDocument();
    // El editor de texto ya no está.
    expect(screen.queryByRole('textbox', { name: /Texto del contrato/ })).not.toBeInTheDocument();
  });

  it('sube nombre, para contratos y el Word', async () => {
    subirPlantilla.mockResolvedValueOnce(WORD);
    render(<PlantillasVista plantillas={[]} />);
    abrirSubida();
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Comercial' } });
    fireEvent.change(screen.getByLabelText(/Para contratos/), { target: { value: 'comercial' } });
    const archivo = docx();
    fireEvent.change(screen.getByLabelText(/Archivo de Word/), { target: { files: [archivo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    await waitFor(() =>
      expect(subirPlantilla).toHaveBeenCalledWith(
        'token',
        { nombre: 'Comercial', tipoContrato: 'comercial' },
        archivo,
      ),
    );
  });

  it('muestra cada marcador que la API rechazó, uno por línea', async () => {
    subirPlantilla.mockRejectedValueOnce(
      new Error(
        'La plantilla tiene 2 problemas:\n• «{deposto}» no es un marcador conocido. ¿Quisiste decir {deposito}?\n• «{desde}» solo se puede usar adentro de {#tramos}…{/tramos}.',
      ),
    );
    render(<PlantillasVista plantillas={[]} />);
    abrirSubida();
    fireEvent.change(screen.getByLabelText(/Archivo de Word/), { target: { files: [docx()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('«{deposto}» no es un marcador conocido.');
    expect(alerta).toHaveTextContent('«{desde}» solo se puede usar adentro de {#tramos}');
    expect(alerta).toHaveClass('whitespace-pre-line');
    // El modal sigue abierto para corregir y volver a subir.
    expect(screen.getByRole('button', { name: 'Subir' })).toBeInTheDocument();
  });

  it('un archivo que no es .docx se avisa sin mandarlo', async () => {
    render(<PlantillasVista plantillas={[]} />);
    abrirSubida();
    fireEvent.change(screen.getByLabelText(/Archivo de Word/), {
      target: { files: [docx('Contrato.doc')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Los .doc viejos no sirven: abrilo en Word y guardalo como .docx.',
    );
    expect(subirPlantilla).not.toHaveBeenCalled();
  });

  it('descarga el Word de una plantilla con su nombre', async () => {
    const blob = new Blob(['PK']);
    descargarPlantilla.mockResolvedValueOnce({ blob, nombre: 'Contrato Alteva.docx' });
    render(<PlantillasVista plantillas={[WORD]} />);
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Descargar' }));
    await waitFor(() =>
      expect(descargarArchivo).toHaveBeenCalledWith(blob, 'Contrato Alteva.docx'),
    );
    expect(descargarPlantilla).toHaveBeenCalledWith('token', WORD.id);
  });

  it('descarga el ejemplo con todos los marcadores', async () => {
    const blob = new Blob(['PK']);
    descargarEjemploPlantilla.mockResolvedValueOnce({ blob, nombre: 'Ejemplo.docx' });
    render(<PlantillasVista plantillas={[]} />);
    fireEvent.click(
      screen.getByRole('button', { name: '⬇️ Descargar el ejemplo con todos los marcadores' }),
    );
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith(blob, 'Ejemplo.docx'));
  });
});
