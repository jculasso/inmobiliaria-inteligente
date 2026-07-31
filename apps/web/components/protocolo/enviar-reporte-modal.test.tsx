import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnviarReporteModal } from './enviar-reporte-modal';

vi.mock('../../lib/supabase/client', () => ({ getAccessToken: async () => 'tok' }));

const getDestinatarios = vi.fn();
const enviar = vi.fn();
vi.mock('../../lib/protocolo-api', () => ({
  getDestinatariosReporte: (...a: unknown[]) => getDestinatarios(...a),
  enviarReporteSemanal: (...a: unknown[]) => enviar(...a),
}));

describe('EnviarReporteModal', () => {
  beforeEach(() => {
    getDestinatarios.mockReset();
    enviar.mockReset();
  });

  /**
   * El caso que motivó el modal: el usuario mandó el reporte, no llegó nada, y
   * el motivo —que no había nadie marcado— iba en una línea gris de once
   * píxeles que no vio. Ahora se ve antes de apretar, y el botón no se puede
   * apretar.
   */
  it('sin destinatarios lo explica y no deja enviar', async () => {
    getDestinatarios.mockResolvedValue([]);
    render(<EnviarReporteModal onClose={() => {}} />);

    expect(await screen.findByText(/Todavía no hay destinatarios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar ahora/i })).toBeDisabled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('muestra a quiénes les va a llegar ANTES de mandar', async () => {
    getDestinatarios.mockResolvedValue([
      { nombre: 'Javier Culasso', email: 'javierblasculasso@gmail.com' },
      { nombre: 'Ezequiel Olivera', email: 'ezequiel@vacker.com.ar' },
    ]);
    render(<EnviarReporteModal onClose={() => {}} />);

    expect(await screen.findByText(/2 personas/i)).toBeInTheDocument();
    expect(screen.getByText('Javier Culasso')).toBeInTheDocument();
    expect(screen.getByText(/javierblasculasso@gmail.com/)).toBeInTheDocument();
    // Todavía no se mandó nada: mostrar la lista no es enviar.
    expect(enviar).not.toHaveBeenCalled();
  });

  it('al enviar confirma cuántos salieron y avisa por el spam', async () => {
    getDestinatarios.mockResolvedValue([{ nombre: 'Javier', email: 'j@x.com' }]);
    enviar.mockResolvedValue({ enviado: true, destinatarios: ['j@x.com'] });
    render(<EnviarReporteModal onClose={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: /Enviar ahora/i }));

    await waitFor(() => expect(screen.getByText(/Salió a 1 destinatario/i)).toBeInTheDocument());
    expect(screen.getByText(/correo no deseado/i)).toBeInTheDocument();
    // Ya no se puede mandar dos veces desde el mismo modal.
    expect(screen.queryByRole('button', { name: /Enviar ahora/i })).not.toBeInTheDocument();
  });

  it('si la API dice que no se mandó, muestra el motivo', async () => {
    getDestinatarios.mockResolvedValue([{ nombre: 'Javier', email: 'j@x.com' }]);
    enviar.mockResolvedValue({
      enviado: false,
      destinatarios: ['j@x.com'],
      motivo: 'No hay propiedades en comercialización: no se manda un reporte vacío.',
    });
    render(<EnviarReporteModal onClose={() => {}} />);

    await userEvent.click(await screen.findByRole('button', { name: /Enviar ahora/i }));

    await waitFor(() =>
      expect(screen.getByText(/no se manda un reporte vacío/i)).toBeInTheDocument(),
    );
  });
});
