import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CandidataDto, ProtocoloResumenDto } from '@vacker/types';
import { ReporteGeneral } from './reporte-general';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: () => Promise.resolve('token') }));

const archivarProtocolo = vi.fn();
vi.mock('../../lib/protocolo-api', () => ({
  archivarProtocolo: (...args: unknown[]) => archivarProtocolo(...args),
  desarchivarProtocolo: vi.fn(),
}));

const AGENTE = { id: 'u1', nombre: 'Ana Gómez', email: 'ana@vacker.com', telefono: null, fotoUrl: null };

function protocolo(over: Partial<ProtocoloResumenDto> = {}): ProtocoloResumenDto {
  return {
    id: 'p1',
    version: '2026-07-15T10:00:00.000Z',
    estado: 'activa',
    fechaInicio: '2026-07-01',
    semanaActual: 3,
    diasPublicada: 15,
    avance: 0.5,
    precioPublicado: 185000,
    moneda: 'USD',
    vencimientoAutorizacion: null,
    archivadoEn: null,
    motivoArchivo: null,
    agente: AGENTE,
    propiedad: {
      tasacionId: 't1',
      direccion: 'Córdoba 1234',
      barrio: 'Centro',
      ciudad: 'Rosario',
      tipoPropiedad: 'Departamento',
      tipoOperacion: 'venta',
      superficieTotal: 96,
      dormitorios: 2,
      banos: 1,
      valorRecomendado: 190000,
      fotoUrl: null,
    },
    alertas: [],
    proximaAccion: null,
    ...over,
  };
}

const CAPTADA: CandidataDto = {
  tasacionId: 't2',
  codigo: 'TAS-1',
  direccion: 'Mitre 500',
  barrio: null,
  ciudad: 'Rosario',
  tipoPropiedad: 'Casa',
  tipoOperacion: 'venta',
  cliente: 'Juan Pérez',
  fecha: '2026-07-10',
  valorRecomendado: 120000,
  diasExclusividad: 90,
  fotoUrl: null,
  agente: AGENTE,
};

const ARCHIVADA = protocolo({
  id: 'p2',
  estado: 'archivada',
  propiedad: { ...protocolo().propiedad, direccion: 'San Martín 900' },
  archivadoEn: '2026-08-01',
  motivoArchivo: 'vendida',
});

function renderReporte(over: Partial<Parameters<typeof ReporteGeneral>[0]> = {}) {
  return render(
    <ReporteGeneral
      captadas={[CAPTADA]}
      activas={[protocolo()]}
      archivadas={[ARCHIVADA]}
      puedeReabrir={false}
      {...over}
    />,
  );
}

describe('ReporteGeneral', () => {
  it('abre en "En comercialización" y muestra la cantidad de cada grupo', () => {
    renderReporte();
    expect(screen.getByRole('button', { name: /Captadas · 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /En comercialización · 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archivadas · 1/ })).toBeInTheDocument();
    expect(screen.getByText('Córdoba 1234')).toBeInTheDocument();
  });

  it('cambia de grupo al tocar la solapa', async () => {
    const user = userEvent.setup();
    renderReporte();

    await user.click(screen.getByRole('button', { name: /Captadas · 1/ }));
    expect(screen.getByText('Mitre 500')).toBeInTheDocument();
    expect(screen.queryByText('Córdoba 1234')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Archivadas · 1/ }));
    expect(screen.getByText('San Martín 900')).toBeInTheDocument();
    expect(screen.getByText('Vendida')).toBeInTheDocument();
  });

  it('el botón Archivar abre el modal con la propiedad elegida', async () => {
    const user = userEvent.setup();
    renderReporte();

    await user.click(screen.getByRole('button', { name: 'Archivar' }));

    expect(screen.getByRole('heading', { name: 'Archivar propiedad' })).toBeInTheDocument();
    // Avisa que deja de alertar y que se puede reabrir: es una acción reversible.
    expect(screen.getByText(/deja de generar alertas/)).toBeInTheDocument();
  });

  it('solo ofrece Reabrir a quien tiene permiso', async () => {
    const user = userEvent.setup();
    const { unmount } = renderReporte({ puedeReabrir: false });
    await user.click(screen.getByRole('button', { name: /Archivadas · 1/ }));
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
    unmount();

    renderReporte({ puedeReabrir: true });
    await user.click(screen.getByRole('button', { name: /Archivadas · 1/ }));
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
  });

  it('al archivar, la propiedad cambia de solapa al instante y avisa que guarda', async () => {
    const user = userEvent.setup();
    // La API nunca resuelve: si la UI la esperara, la fila no se movería.
    archivarProtocolo.mockReturnValue(new Promise(() => {}));
    renderReporte({ archivadas: [] });

    await user.click(screen.getByRole('button', { name: 'Archivar' }));
    // Confirmar dentro del modal (el de la tabla queda detrás).
    const dialogo = screen.getByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Archivar' }));

    expect(screen.getByRole('status')).toHaveTextContent('Guardando…');
    // Salió de "En comercialización" y entró en "Archivadas", sin esperar al server.
    expect(screen.getByRole('button', { name: /En comercialización · 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archivadas · 1/ })).toBeInTheDocument();
  });

  it('muestra un vacío explicativo cuando no hay filas en el grupo', async () => {
    const user = userEvent.setup();
    renderReporte({ archivadas: [] });
    await user.click(screen.getByRole('button', { name: /Archivadas · 0/ }));
    expect(screen.getByText('Todavía no se archivó ninguna propiedad.')).toBeInTheDocument();
  });
});
