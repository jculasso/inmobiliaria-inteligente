import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CandidatoDto, PreparacionCobroDto } from '@vacker/types';

const prepararCobro = vi.fn();
const registrarCobro = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('token') }));
vi.mock('../../lib/abrir-pdf', () => ({ abrirPdfEnPestana: vi.fn() }));
vi.mock('../../lib/alquileres-api', () => ({
  prepararCobro: (...a: unknown[]) => prepararCobro(...a),
  registrarCobro: (...a: unknown[]) => registrarCobro(...a),
  generarRecibo: vi.fn(),
}));

import { CobroForm } from './cobro-form';

const PERSONA = '11111111-1111-4111-8111-111111111111';
const ALQ = '22222222-2222-4222-8222-222222222222';
const GAS = '33333333-3333-4333-8333-333333333333';

/* Noviembre de 2026 del contrato #5, cobrado el 15: diez días de atraso. */
const prep = (over: Partial<PreparacionCobroDto> = {}): PreparacionCobroDto => ({
  persona: { id: PERSONA, nombre: 'Romina Inquilina' },
  moneda: 'ARS',
  fecha: '2026-11-15',
  deudas: [
    { conceptoId: ALQ, contrato: { id: crypto.randomUUID(), codigo: '5' }, tipo: 'alquiler', descripcion: 'Alquiler noviembre 2026', vencimiento: '2026-11-05', importe: 1_137_518, saldo: 1_137_518, punitorio: { dias: 10, importe: 11_375.18 } },
    { conceptoId: GAS, contrato: { id: crypto.randomUUID(), codigo: '5' }, tipo: 'gastos_adm', descripcion: 'Gastos administrativos noviembre 2026', vencimiento: '2026-11-05', importe: 27_527.94, saldo: 27_527.94, punitorio: null },
  ],
  compensables: [],
  creditos: [],
  ...over,
});

const inquilinos: CandidatoDto[] = [
  { persona: { id: PERSONA, nombre: 'Romina Inquilina' }, papel: 'inquilino', contratos: [{ id: crypto.randomUUID(), codigo: 'ALT-0005', propiedad: 'Calle 1' }], pendiente: [{ moneda: 'ARS', importe: 1_165_045.94 }] },
  { persona: { id: crypto.randomUUID(), nombre: 'Pedro Al Día' }, papel: 'inquilino', contratos: [{ id: crypto.randomUUID(), codigo: 'ALT-0002', propiedad: 'Paraguay 925' }], pendiente: [] },
];

const abrir = async (p = prep()) => {
  prepararCobro.mockResolvedValue(p);
  render(<CobroForm inquilinos={inquilinos} propietarios={[]} personaInicial={PERSONA} hoy="2026-11-15" />);
  await screen.findByText('Alquiler noviembre 2026', { exact: false });
};

describe('CobroForm', () => {
  it('sugiere el total de lo elegido, con el punitorio, y la vista previa dice qué se cancela', async () => {
    await abrir();
    // 1.137.518 + 11.375,18 + 27.527,94
    expect(screen.getByText(/Para cancelar lo elegido: \$ 1\.176\.421,12/)).toBeInTheDocument();
    // El punitorio se cancela junto al alquiler; lo que sobra va a los gastos.
    fireEvent.change(screen.getByLabelText('Importe recibido'), { target: { value: '1.160.000' } });
    expect(screen.getByText('Se cancela')).toBeInTheDocument();
    expect(screen.getByText(/Queda debiendo \$ 16\.421,12/)).toBeInTheDocument();
  });

  // Regla 17: el saldo a favor se descuenta solo.
  it('el saldo a favor de un recibo anterior baja lo sugerido', async () => {
    await abrir(prep({ creditos: [{ cobroId: crypto.randomUUID(), numero: 7, disponible: 76_421.12 }] }));
    expect(screen.getByText(/A su favor del recibo 000007/)).toBeInTheDocument();
    expect(screen.getByText(/Para cancelar lo elegido: \$ 1\.100\.000,00/)).toBeInTheDocument();
  });

  // Regla 16: condonar pide motivo, y no se manda nada hasta tenerlo.
  it('bajar el punitorio pide el motivo antes de registrar', async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText('Punitorio de Alquiler noviembre 2026'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Importe recibido'), { target: { value: '1.165.045,94' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar el cobro/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('hace falta el motivo');
    expect(registrarCobro).not.toHaveBeenCalled();
  });

  // Regla 15: el navegador manda qué se elige y el punitorio; la imputación la hace la API.
  it('registra con lo elegido y el punitorio, sin imputaciones calculadas en el navegador', async () => {
    registrarCobro.mockResolvedValueOnce({ id: crypto.randomUUID(), numero: 8, persona: { id: PERSONA, nombre: 'Romina Inquilina' }, importe: 1_148_893.18, moneda: 'ARS', aFavor: 0 });
    await abrir();
    fireEvent.click(screen.getByLabelText(/Gastos administrativos noviembre 2026/));
    fireEvent.change(screen.getByLabelText('Importe recibido'), { target: { value: '1.148.893,18' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar el cobro/ }));
    await waitFor(() => expect(registrarCobro).toHaveBeenCalled());
    const dto = registrarCobro.mock.calls[0]![1];
    expect(dto).toEqual({
      personaId: PERSONA,
      fecha: '2026-11-15',
      moneda: 'ARS',
      importe: 1_148_893.18,
      medio: 'transferencia',
      obs: '',
      conceptoIds: [ALQ],
      punitorios: [{ conceptoId: ALQ, importe: 11_375.18, motivo: '' }],
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Recibo 000008');
  });

  // Revisión del 6/10/2026: cambiar la fecha volvía a tildar todo.
  it('cambiar la fecha recalcula el punitorio pero respeta lo que se destildó', async () => {
    await abrir();
    const gastos = () => screen.getByRole('checkbox', { name: /Gastos administrativos/ });
    fireEvent.click(gastos());
    expect(gastos()).not.toBeChecked();
    prepararCobro.mockResolvedValue(prep({ fecha: '2026-11-20' }));
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-11-20' } });
    await waitFor(() => expect(prepararCobro).toHaveBeenLastCalledWith('token', PERSONA, 'ARS', '2026-11-20'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Alquiler noviembre/ })).toBeChecked());
    expect(gastos()).not.toBeChecked();
  });
});

