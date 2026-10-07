import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DocumentoContratoDto } from '@vacker/types';

const cambiarFirma = vi.fn();
const enviarAFirmar = vi.fn();
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  cambiarFirma: (...a: unknown[]) => cambiarFirma(...a),
  enviarAFirmar: (...a: unknown[]) => enviarAFirmar(...a),
  cargarDocumentoContrato: vi.fn(),
  cargarContratoFirmado: vi.fn(),
  urlDocumento: vi.fn(),
}));

import { FirmaContrato } from './firma-contrato';

const DUENO = '11111111-1111-4111-8111-111111111111';
const INQ = '22222222-2222-4222-8222-222222222222';
const doc = (over: Partial<DocumentoContratoDto> = {}): DocumentoContratoDto => ({
  id: '66666666-6666-4666-8666-666666666666',
  contratoId: '55555555-5555-4555-8555-555555555555',
  estadoFirma: 'enviado',
  proveedor: 'manual',
  nombreArchivo: 'Contrato 5.pdf',
  tieneFirmado: false,
  firmantes: [
    {
      personaId: DUENO,
      nombre: 'Dueño',
      papel: 'propietario',
      estado: 'pendiente',
      firmadoEl: null,
    },
    {
      personaId: INQ,
      nombre: 'Inquilina',
      papel: 'inquilino',
      estado: 'pendiente',
      firmadoEl: null,
    },
  ],
  eventos: [
    {
      fecha: '2026-10-06T13:00:00Z',
      estadoAnterior: 'sin_enviar',
      estadoNuevo: 'enviado',
      origen: 'manual',
      detalle: 'Se marcó como enviado.',
    },
  ],
  ...over,
});

describe('FirmaContrato', () => {
  // Regla 36: vigente sin documento es posible; se ofrece cargarlo.
  it('sin documento, explica y ofrece cargar el PDF', () => {
    render(<FirmaContrato contratoId="c" documento={null} />);
    expect(screen.getByText(/se firmó en papel y se carga después/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar el PDF' })).toBeInTheDocument();
  });

  // Regla 34: el cambio manual manda quién firmó; el estado lo decide la API.
  it('marcar quién firmó y guardar manda solo los cambios', async () => {
    cambiarFirma.mockResolvedValueOnce(doc({ estadoFirma: 'firmado_parcial' }));
    render(<FirmaContrato contratoId="c" documento={doc()} />);
    fireEvent.change(screen.getByLabelText('Firma de Dueño'), { target: { value: 'firmado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar las firmas' }));
    await waitFor(() =>
      expect(cambiarFirma).toHaveBeenCalledWith('token', doc().id, {
        firmantes: [{ personaId: DUENO, estado: 'firmado' }],
      }),
    );
    expect(await screen.findByText('Firmado en parte')).toBeInTheDocument();
  });

  it('enviado: no deja cambiar el PDF, sí subir el firmado o marcar vencido', () => {
    render(<FirmaContrato contratoId="c" documento={doc()} />);
    expect(screen.queryByRole('button', { name: 'Cambiar el PDF' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir el contrato firmado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar como vencido' })).toBeInTheDocument();
  });

  it('el historial muestra cada cambio con su origen', () => {
    render(<FirmaContrato contratoId="c" documento={doc()} />);
    expect(
      screen.getByText(/Sin enviar → Enviado a firmar · a mano · Se marcó como enviado\./),
    ).toBeInTheDocument();
  });

  // Prueba en producción, 6/10/2026: con todos en «Firmó» desaparecía el botón
  // y el PDF firmado no se podía subir nunca.
  it('firmado sin el PDF firmado: deja subirlo, y no ofrece marcar como vencido', () => {
    render(<FirmaContrato contratoId="c" documento={doc({ estadoFirma: 'firmado' })} />);
    expect(screen.getByRole('button', { name: 'Subir el contrato firmado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como vencido' })).not.toBeInTheDocument();
  });

  it('firmado con el PDF firmado: deja reemplazarlo', () => {
    render(
      <FirmaContrato
        contratoId="c"
        documento={doc({ estadoFirma: 'firmado', tieneFirmado: true })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Reemplazar el contrato firmado' }),
    ).toBeInTheDocument();
  });

  // Generar el PDF desde la plantilla refresca la página: el panel tiene que
  // mostrar el documento nuevo sin recargar.
  it('cuando la página trae el documento nuevo, se ve sin recargar', () => {
    const { rerender } = render(<FirmaContrato contratoId="c" documento={null} />);
    expect(screen.getByText(/Todavía no se cargó el PDF del contrato/)).toBeInTheDocument();
    rerender(
      <FirmaContrato contratoId="c" documento={doc({ estadoFirma: 'sin_enviar', eventos: [] })} />,
    );
    expect(screen.queryByText(/Todavía no se cargó el PDF del contrato/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contrato 5.pdf' })).toBeInTheDocument();
  });

  it('un refresh que trae lo mismo no borra las firmas sin guardar', () => {
    const { rerender } = render(<FirmaContrato contratoId="c" documento={doc()} />);
    fireEvent.change(screen.getByLabelText('Firma de Dueño'), { target: { value: 'firmado' } });
    rerender(<FirmaContrato contratoId="c" documento={doc()} />);
    expect(screen.getByLabelText('Firma de Dueño')).toHaveValue('firmado');
    expect(screen.getByRole('button', { name: 'Guardar las firmas' })).toBeInTheDocument();
  });
});
