import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContratoDto } from '@vacker/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
const cambiarEstadoContrato = vi.fn();
const getCorreccionTramo = vi.fn();
const corregirImporteTramo = vi.fn();
vi.mock('../../lib/alquileres-api', () => ({
  cambiarEstadoContrato: (...a: unknown[]) => cambiarEstadoContrato(...a),
  getCorreccionTramo: (...a: unknown[]) => getCorreccionTramo(...a),
  corregirImporteTramo: (...a: unknown[]) => corregirImporteTramo(...a),
}));

import { ContratoFicha } from './contrato-ficha';

const base: ContratoDto = {
  id: 'c1',
  codigo: '25',
  estado: 'borrador',
  tipo: 'comercial',
  moneda: 'ARS',
  inicio: '2024-11-01',
  fin: '2026-10-31',
  fechaFirma: null,
  diaVencimiento: 5,
  diaPagoPropietario: 10,
  ajuste: 'indexado',
  indice: 'ICL',
  periodicidadMeses: 4,
  honorariosPct: 2.48,
  gastosAdmPct: 2,
  ivaPct: 0,
  punitorioDiarioPct: 0.5,
  pagoGarantizado: false,
  inquilinoMipyme: false,
  administradoDesde: null,
  depositoImporte: null,
  depositoMoneda: null,
  depositoDevolucion: null,
  rescindidoEl: null,
  obs: null,
  registrado: { en: '2026-10-06T15:00:00Z', por: 'Lucía Operadora' },
  anulado: null,
  propiedad: { id: 'p', direccion: 'Calle 123', unidad: null, ciudad: 'Rosario' },
  partes: [],
  tramos: [
    {
      numero: 1,
      desde: '2024-11-01',
      hasta: '2025-02-28',
      importe: 250_000,
      confirmadoEl: null,
      indiceBase: null,
      indiceRequerido: null,
      importePropuesto: null,
    },
    {
      numero: 2,
      desde: '2025-03-01',
      hasta: '2025-06-30',
      importe: null,
      confirmadoEl: null,
      indiceBase: null,
      indiceRequerido: null,
      importePropuesto: null,
    },
  ],
};

beforeEach(() => cambiarEstadoContrato.mockReset());

describe('ContratoFicha — acciones según el estado (reglas 2 y 3)', () => {
  it('en borrador: editar y activar; no se puede rescindir', () => {
    render(<ContratoFicha contrato={base} />);
    expect(screen.getByRole('button', { name: 'Activar contrato' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '✏️ Editar' })).toHaveAttribute(
      'href',
      '/alquileres/contratos/c1/editar',
    );
    expect(screen.queryByRole('button', { name: 'Rescindir' })).not.toBeInTheDocument();
  });

  it('vigente: finalizar o rescindir; ya no se edita', () => {
    render(<ContratoFicha contrato={{ ...base, estado: 'vigente' }} />);
    expect(screen.getByRole('button', { name: 'Rescindir' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '✏️ Editar' })).not.toBeInTheDocument();
  });

  it('rescindir pide la fecha y la manda', async () => {
    cambiarEstadoContrato.mockResolvedValue({});
    render(<ContratoFicha contrato={{ ...base, estado: 'vigente' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Rescindir' }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByRole('button', { name: 'Rescindir' })).toBeDisabled();
    await userEvent.type(dialogo.getByLabelText(/Fecha de rescisión/), '2025-06-30');
    await userEvent.click(dialogo.getByRole('button', { name: 'Rescindir' }));
    expect(cambiarEstadoContrato).toHaveBeenCalledWith('token', 'c1', {
      estado: 'rescindido',
      fecha: '2025-06-30',
    });
  });

  it('un tramo sin indexar se marca, no se muestra en cero', () => {
    render(<ContratoFicha contrato={base} />);
    expect(screen.getByText('$ 250.000,00')).toBeInTheDocument();
    expect(screen.getByText('A indexar')).toBeInTheDocument();
  });

  // No hay generación automática: los alquileres salen de «Generar» en Conceptos.
  it('activar dice la verdad: entra en «Generar» de Conceptos, no se genera solo', async () => {
    render(<ContratoFicha contrato={base} />);
    await userEvent.click(screen.getByRole('button', { name: 'Activar contrato' }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText(/entra cada mes en «Generar» de Conceptos/)).toBeInTheDocument();
    expect(dialogo.queryByText(/genera sus alquileres/)).not.toBeInTheDocument();
  });
});

describe('ContratoFicha — corregir el importe de un tramo (reglas 108 a 110)', () => {
  const vigente = { ...base, estado: 'vigente' as const };

  it('un tramo confirmado de un contrato vigente se puede corregir; uno a indexar, no', () => {
    render(<ContratoFicha contrato={vigente} />);
    expect(screen.getAllByRole('button', { name: 'Corregir importe' })).toHaveLength(1);
  });

  it('en un borrador no se corrige: se edita completo', () => {
    render(<ContratoFicha contrato={base} />);
    expect(screen.queryByRole('button', { name: 'Corregir importe' })).not.toBeInTheDocument();
  });

  it('propone el primer mes sin cobrar, dice qué pasa con cada mes y manda importe, mes y motivo', async () => {
    getCorreccionTramo.mockResolvedValue({
      numero: 1,
      desde: '2024-11-01',
      hasta: '2025-02-28',
      importe: 250_000,
      meses: [
        { periodo: '2024-11', estado: 'cobrado' },
        { periodo: '2024-12', estado: 'generado' },
        { periodo: '2025-01', estado: 'cobrado' },
        { periodo: '2025-02', estado: 'sin_generar' },
      ],
      desdeSugerido: '2024-12',
    });
    corregirImporteTramo.mockResolvedValue({});
    render(<ContratoFicha contrato={vigente} />);
    await userEvent.click(screen.getByRole('button', { name: 'Corregir importe' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(await dialogo.findByLabelText(/Desde qué mes/)).toHaveValue('2024-12');
    expect(
      dialogo.getByText(/Se vuelve a generar con el importe nuevo: diciembre de 2024/),
    ).toBeInTheDocument();
    expect(dialogo.getByText(/Queda como está: enero de 2025 \(cobrado\)/)).toBeInTheDocument();
    expect(dialogo.getByText(/Todavía sin generar: febrero de 2025/)).toBeInTheDocument();

    const corregir = dialogo.getByRole('button', { name: 'Corregir el importe' });
    await userEvent.type(dialogo.getByLabelText(/Importe mensual nuevo/), '230000');
    // Sin motivo no se puede.
    expect(corregir).toBeDisabled();
    await userEvent.type(dialogo.getByLabelText(/Motivo/), 'Lo negociaron las partes');
    await userEvent.click(corregir);
    expect(corregirImporteTramo).toHaveBeenCalledWith('token', 'c1', 1, {
      importe: 230_000,
      desde: '2024-12',
      motivo: 'Lo negociaron las partes',
    });
  });

  it('regla 106: en un contrato tomado en curso, los tramos de antes no figuran «a indexar»', () => {
    render(
      <ContratoFicha
        contrato={{
          ...vigente,
          administradoDesde: '2025-04-01',
          tramos: [
            { ...base.tramos[0]!, importe: null },
            { ...base.tramos[1]!, importe: 300_000 },
          ],
        }}
      />,
    );
    expect(screen.getByText('Antes de administrarlo')).toBeInTheDocument();
    expect(screen.queryByText('A indexar')).not.toBeInTheDocument();
    expect(screen.getByText(/01\/04\/2025 \(tomado en curso\)/)).toBeInTheDocument();
  });
});
