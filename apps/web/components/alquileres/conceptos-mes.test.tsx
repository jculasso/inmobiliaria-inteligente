import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ConceptoDto, ContratoResumenDto } from '@vacker/types';

const generarPeriodo = vi.fn();
const crearConceptoSuelto = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  generarPeriodo: (...a: unknown[]) => generarPeriodo(...a),
  crearConceptoSuelto: (...a: unknown[]) => crearConceptoSuelto(...a),
  anularConcepto: vi.fn(),
}));

import { ConceptosMes, textoGeneracion } from './conceptos-mes';

const C5 = '55555555-5555-4555-8555-555555555555';
const k = (over: Partial<ConceptoDto>): ConceptoDto => ({
  id: crypto.randomUUID(),
  contrato: { id: C5, codigo: 'ALT-0005', direccion: 'Calle 1' },
  persona: { id: crypto.randomUUID(), nombre: 'Inquilino' },
  tipo: 'alquiler',
  sentido: 'a_cobrar',
  moneda: 'ARS',
  periodo: '2026-11',
  vencimiento: '2026-11-05',
  importe: 1_137_518,
  adelantadoPorInmobiliaria: false,
  descripcion: 'Alquiler noviembre 2026',
  generado: true,
  aplicado: false,
  anulado: null,
  saldo: 1_137_518,
  estado: 'pendiente',
  papel: 'inquilino',
  registrado: null,
  ...over,
});

/* Noviembre de 2026 del contrato #5, como en Gexion. */
const NOVIEMBRE = [
  k({}),
  k({
    tipo: 'gastos_adm',
    importe: 27_527.94,
    descripcion: 'Gastos administrativos noviembre 2026',
  }),
  k({
    sentido: 'a_pagar',
    persona: { id: crypto.randomUUID(), nombre: 'Propietario' },
    vencimiento: '2026-11-10',
    papel: 'propietario',
  }),
  k({
    tipo: 'honorarios',
    importe: 110_111.74,
    persona: { id: crypto.randomUUID(), nombre: 'Propietario' },
    descripcion: 'Honorarios noviembre 2026',
    papel: 'propietario',
  }),
];

const contrato = {
  id: crypto.randomUUID(),
  codigo: '5',
  estado: 'vigente',
  propiedad: { direccion: 'Calle 1', unidad: null },
} as ContratoResumenDto;

describe('ConceptosMes', () => {
  it('los totales: a cobrar, a pagar y lo que es de la inmobiliaria', () => {
    render(<ConceptosMes periodo="2026-11" conceptos={NOVIEMBRE} contratos={[contrato]} />);
    const tarjeta = (titulo: string) =>
      screen.getByText(titulo, { selector: 'p' }).closest('.rounded-brand')!;
    expect(tarjeta('A cobrar')).toHaveTextContent('$ 1.275.157,68'); // 1.137.518 + 27.527,94 + 110.111,74
    expect(tarjeta('A pagar')).toHaveTextContent('$ 1.137.518,00');
    expect(tarjeta('Para la inmobiliaria')).toHaveTextContent('$ 137.639,68');
  });

  it('un anulado se ve tachado con su motivo y no suma', () => {
    const anulado = k({
      importe: 999,
      descripcion: 'Expensas',
      tipo: 'expensa',
      generado: false,
      anulado: { en: '2026-11-02T10:00:00Z', motivo: 'Cargado dos veces', por: null },
    });
    render(
      <ConceptosMes periodo="2026-11" conceptos={[...NOVIEMBRE, anulado]} contratos={[contrato]} />,
    );
    expect(
      within(screen.getByRole('table')).getByText(/Anulado: Cargado dos veces/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A cobrar', { selector: 'p' }).closest('.rounded-brand'),
    ).toHaveTextContent('$ 1.275.157,68');
  });

  // Punto 4 de Javier: por contrato, con lo que deja, a quién va y en qué estado está.
  it('agrupa por contrato: paga el inquilino, recibe el propietario, para la inmobiliaria', () => {
    render(<ConceptosMes periodo="2026-11" conceptos={NOVIEMBRE} contratos={[contrato]} />);
    const grupo = within(screen.getByRole('region', { name: 'Contrato ALT-0005' }));
    // El inquilino: alquiler + gastos. El propietario: alquiler − honorarios.
    expect(grupo.getByText('Paga el inquilino').nextSibling).toHaveTextContent('$ 1.165.045,94');
    expect(grupo.getByText('Recibe el propietario').nextSibling).toHaveTextContent(
      '$ 1.027.406,26',
    );
    expect(grupo.getByText('Para la inmobiliaria').nextSibling).toHaveTextContent('$ 137.639,68');
    const tabla = within(grupo.getByRole('table'));
    expect(tabla.getAllByText('Cobrar a').length).toBe(2);
    expect(tabla.getByText('Pagar a')).toBeInTheDocument();
    expect(tabla.getByText('Descontar a')).toBeInTheDocument();
    expect(tabla.getAllByText('Pendiente').length).toBe(4);
  });

  it('el estado de cada concepto, en palabras', () => {
    render(
      <ConceptosMes
        periodo="2026-11"
        conceptos={[
          k({ estado: 'parcial', saldo: 37_518 }),
          k({ estado: 'liquidado', sentido: 'a_pagar', papel: 'propietario' }),
        ]}
        contratos={[contrato]}
      />,
    );
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByText('Cobrado en parte')).toBeInTheDocument();
    expect(tabla.getByText('falta $ 37.518,00')).toBeInTheDocument();
    expect(tabla.getByText('Liquidado')).toBeInTheDocument();
  });

  it('lo que tiene cobros aplicados no ofrece «Anular»', () => {
    render(
      <ConceptosMes periodo="2026-11" conceptos={[k({ aplicado: true })]} contratos={[contrato]} />,
    );
    expect(
      within(screen.getByRole('table')).queryByRole('button', { name: /Anular/ }),
    ).not.toBeInTheDocument();
  });

  it('el botón de anular dice qué concepto anula', () => {
    render(<ConceptosMes periodo="2026-11" conceptos={[k({})]} contratos={[contrato]} />);
    expect(
      within(screen.getByRole('table')).getByRole('button', {
        name: 'Anular Alquiler noviembre 2026 de Inquilino',
      }),
    ).toBeInTheDocument();
  });

  it('en el teléfono también se ve lo que falta de un cobro en parte', () => {
    render(
      <ConceptosMes
        periodo="2026-11"
        conceptos={[k({ estado: 'parcial', saldo: 37_518, adelantadoPorInmobiliaria: true })]}
        contratos={[contrato]}
      />,
    );
    const movil = screen.getAllByRole('list').find((l) => l.className.includes('sm:hidden'))!;
    expect(within(movil).getByText('falta $ 37.518,00')).toBeInTheDocument();
    expect(within(movil).getByText('Adelantado')).toBeInTheDocument();
  });

  // Reglas 10 y 11: lo que informa «Generar».
  it('generar informa lo creado y lo que quedó sin indexar, con el camino a indexar', async () => {
    generarPeriodo.mockResolvedValueOnce({
      periodo: '2026-12',
      contratos: 78,
      creados: 300,
      existentes: 4,
      sinIndexar: [
        {
          contratoId: crypto.randomUUID(),
          codigo: '5',
          direccion: 'Calle 1',
          tramo: 5,
          desde: '2026-12-15',
          hasta: '2026-12-31',
        },
      ],
    });
    render(<ConceptosMes periodo="2026-12" conceptos={[]} contratos={[contrato]} />);
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Generar diciembre' }));
    const estado = await screen.findByRole('status');
    expect(estado).toHaveTextContent(
      'Se generaron 300 conceptos nuevos. 4 ya estaban (se revisaron 78 contratos).',
    );
    expect(estado).toHaveTextContent('5 (15/12 al 31/12)');
    expect(within(estado).getByRole('link', { name: 'Ir a indexar' })).toHaveAttribute(
      'href',
      '/alquileres/indexaciones',
    );
    expect(generarPeriodo).toHaveBeenCalledWith('token', '2026-12');
  });

  it('el mes vacío explica qué hace «Generar»', () => {
    render(<ConceptosMes periodo="2026-12" conceptos={[]} contratos={[contrato]} />);
    expect(screen.getByText('Todavía no hay conceptos de diciembre de 2026.')).toBeInTheDocument();
  });

  // Regla 14: quien lo debe no aparece como quien ya lo pagó.
  it('gasto suelto: «ya lo pagó» ofrece a la otra parte, no a quien lo debe', async () => {
    crearConceptoSuelto.mockResolvedValueOnce([k({}), k({})]);
    render(<ConceptosMes periodo="2026-11" conceptos={[]} contratos={[contrato]} />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Gasto suelto' }));
    fireEvent.change(screen.getByLabelText(/Contrato/), { target: { value: contrato.id } });
    fireEvent.change(screen.getByLabelText(/Lo debe/), { target: { value: 'propietario' } });
    const pagador = screen.getByLabelText(/Ya lo pagó/) as HTMLSelectElement;
    expect([...pagador.options].map((o) => o.value)).toEqual([
      'nadie',
      'inmobiliaria',
      'inquilino',
    ]);
    fireEvent.change(pagador, { target: { value: 'inquilino' } });
    fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: '140.699' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(crearConceptoSuelto).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          aCargoDe: 'propietario',
          pagadoPor: 'inquilino',
          importe: 140_699,
        }),
      ),
    );
    expect(await screen.findByText(/el cargo y el reintegro a quien lo pagó/)).toBeInTheDocument();
  });

  // Prueba en producción, 6/10/2026: venía elegido el primer contrato y era
  // fácil cargarle el gasto al equivocado.
  it('gasto suelto: arranca sin contrato y no guarda hasta elegirlo', async () => {
    crearConceptoSuelto.mockClear();
    render(<ConceptosMes periodo="2026-11" conceptos={[]} contratos={[contrato]} />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Gasto suelto' }));
    expect(screen.getByLabelText(/Contrato/)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: '1000' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar' }).closest('form')!);
    expect(await screen.findByText('Elegí el contrato.')).toBeInTheDocument();
    expect(crearConceptoSuelto).not.toHaveBeenCalled();
  });

  it('lo que informa «Generar» no afirma de cuántos contratos son los nuevos, y respeta el singular', () => {
    const r = { periodo: '2026-10', sinIndexar: [] };
    expect(textoGeneracion({ ...r, contratos: 11, creados: 11, existentes: 30 })).toBe(
      'Se generaron 11 conceptos nuevos. 30 ya estaban (se revisaron 11 contratos).',
    );
    expect(textoGeneracion({ ...r, contratos: 1, creados: 1, existentes: 0 })).toBe(
      'Se generó 1 concepto nuevo (se revisó 1 contrato).',
    );
    expect(textoGeneracion({ ...r, contratos: 4, creados: 0, existentes: 12 })).toBe(
      'No había nada nuevo para generar: se revisaron 4 contratos.',
    );
  });
});
