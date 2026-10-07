import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  CadenaInformeDto,
  InformePropietarioDto,
  InformePropietariosDto,
  PersonaFichaDto,
} from '@vacker/types';

const getInformePropietario = vi.fn();
const enviarInformePropietarioPorMail = vi.fn();
const generarInformePropietarioPdf = vi.fn();
const getFichaPersona = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/alquileres/personas/p1',
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('t') }));
const abrirPdfEnPestana = vi.fn();
vi.mock('../../lib/abrir-pdf', () => ({
  abrirPdfEnPestana: (...a: unknown[]) => abrirPdfEnPestana(...a),
}));
vi.mock('../../lib/alquileres-api', () => ({
  getInformePropietario: (...a: unknown[]) => getInformePropietario(...a),
  enviarInformePropietarioPorMail: (...a: unknown[]) => enviarInformePropietarioPorMail(...a),
  generarInformePropietarioPdf: (...a: unknown[]) => generarInformePropietarioPdf(...a),
  getFichaPersona: (...a: unknown[]) => getFichaPersona(...a),
}));

import { InformePropietario } from './informe-propietario';
import { InformePropietarios } from './informe-propietarios';

const PERSONA = '11111111-1111-4111-8111-111111111111';
const C1 = '55555555-5555-4555-8555-555555555555';
const liq = { id: '44444444-4444-4444-8444-444444444444', numero: 12, fecha: '2026-09-10' };

const cadena = (over: Partial<CadenaInformeDto> = {}): CadenaInformeDto => ({
  moneda: 'ARS',
  alquiler: 1_000_000,
  enEspera: 0,
  cobrado: 1_000_000,
  honorarios: 96_800,
  impuestos: 12_345.67,
  expensas: 30_000,
  arreglos: 50_000,
  otros: 0,
  reintegros: 0,
  neto: 810_854.33,
  liquidado: 853_200,
  pendiente: 0,
  aDescontar: 42_345.67,
  ...over,
});

function informe(over: Partial<InformePropietarioDto> = {}): InformePropietarioDto {
  return {
    persona: { id: PERSONA, nombre: 'Marta Propietaria' },
    desde: '2026-09',
    hasta: '2026-09',
    hoy: '2026-10-07',
    resumen: [cadena()],
    deuda: [
      {
        moneda: 'ARS',
        total: 200_000,
        contratos: [{ id: C1, codigo: 'ALT-0001', inquilino: 'Ana Inquilina', importe: 200_000 }],
      },
    ],
    contratos: [
      {
        id: C1,
        codigo: 'ALT-0001',
        moneda: 'ARS',
        estado: 'vigente',
        propiedad: 'Córdoba 1452 3° B',
        inquilinos: ['Ana Inquilina'],
        porcentaje: null,
        alquilerVigente: 1_000_000,
        proximaIndexacion: '2027-03-01',
        vence: '2028-02-29',
        meses: [
          {
            periodo: '2026-09',
            alquiler: 1_000_000,
            cobrado: 1_000_000,
            enEspera: 0,
            cobradoEl: ['2026-09-05'],
            liquidaciones: [liq],
          },
        ],
      },
    ],
    partidas: [
      {
        conceptoId: '00000000-0000-4000-8000-000000000001',
        categoria: 'impuestos',
        nombre: 'TGI (Tasa municipal)',
        detalle: 'TGI (Tasa municipal) cuota 9/12',
        periodo: '2026-09',
        contrato: { id: C1, codigo: 'ALT-0001', propiedad: 'Córdoba 1452 3° B' },
        moneda: 'ARS',
        importe: 12_345.67,
        liquidacion: null,
      },
      {
        conceptoId: '00000000-0000-4000-8000-000000000002',
        categoria: 'expensas',
        nombre: 'Expensas extraordinarias',
        detalle: 'Expensas extraordinarias',
        periodo: '2026-09',
        contrato: { id: C1, codigo: 'ALT-0001', propiedad: 'Córdoba 1452 3° B' },
        moneda: 'ARS',
        importe: 30_000,
        liquidacion: liq,
      },
    ],
    reclamos: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        numero: 7,
        fecha: '2026-09-12',
        asunto: 'Pérdida de agua',
        estado: 'resuelto',
        contrato: { id: C1, codigo: 'ALT-0001' },
        propiedad: 'Córdoba 1452 3° B',
        proveedor: 'Plomero Juan',
        aCargoDelPropietario: [{ moneda: 'ARS', importe: 50_000 }],
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        numero: 8,
        fecha: '2026-09-15',
        asunto: 'Persiana trabada',
        estado: 'en_curso',
        contrato: { id: C1, codigo: 'ALT-0001' },
        propiedad: 'Córdoba 1452 3° B',
        proveedor: null,
        aCargoDelPropietario: [],
      },
    ],
    liquidaciones: [
      { ...liq, medio: 'transferencia', moneda: 'ARS', neto: 853_200, delPeriodo: 853_200 },
    ],
    ...over,
  };
}

const solapa = (inicial = { anio: 2026, periodo: { por: 'mes' as const, mes: 9 } }) =>
  render(<InformePropietario personaId={PERSONA} hoy="2026-10-07" inicial={inicial} />);

beforeEach(() => {
  getInformePropietario.mockReset();
  enviarInformePropietarioPorMail.mockReset();
  abrirPdfEnPestana.mockReset();
  push.mockReset();
});

describe('La solapa Informe del propietario', () => {
  it('regla 87: muestra la cadena del período y lo que debe el inquilino (regla 89)', async () => {
    getInformePropietario.mockResolvedValue(informe());
    solapa();
    const resumen = within(await screen.findByRole('list', { name: 'Resumen en ARS' }));
    expect(getInformePropietario).toHaveBeenCalledWith('t', PERSONA, {
      desde: '2026-09',
      hasta: '2026-09',
    });
    const renglones = resumen.getAllByRole('listitem').map((li) => li.textContent);
    expect(renglones).toEqual([
      'Alquiler del período$ 1.000.000,00',
      'Cobrado$ 1.000.000,00',
      '− Honorarios$ 96.800,00',
      '− Impuestos y servicios$ 12.345,67',
      '− Expensas$ 30.000,00',
      '− Arreglos$ 50.000,00',
      'Neto del período$ 810.854,33',
      'Liquidado (transferido)$ 853.200,00',
      'Pendiente de liquidar$ 0,00',
      // Regla 98: lo que falta descontar, en su renglón y diciendo qué es.
      'A descontar en la próxima liquidaciónImpuesto: TGI (Tasa municipal) cuota 9/12$ 42.345,67',
    ]);
    expect(screen.getByRole('note')).toHaveTextContent('El inquilino debe hoy $ 200.000,00');
  });

  it('reglas 90 a 93: el mes de cada propiedad, los descuentos con su nombre, los reclamos y las liquidaciones', async () => {
    getInformePropietario.mockResolvedValue(informe());
    solapa();
    const meses = within(await screen.findByRole('list', { name: 'Meses de ALT-0001' }));
    expect(meses.getByRole('listitem')).toHaveTextContent(
      'Cobrado $ 1.000.000,00 el 05/09/2026 · Liquidado en la Liquidación 000012 del 10/09/2026',
    );
    expect(
      within(screen.getByRole('list', { name: 'Expensas' })).getByRole('listitem'),
    ).toHaveTextContent(
      /Expensas extraordinarias.*Descontado en la liquidación 000012 del 10\/09\/2026/,
    );
    expect(
      within(screen.getByRole('list', { name: 'Impuestos y servicios' })).getByRole('listitem'),
    ).toHaveTextContent(/TGI \(Tasa municipal\).*Se descontará en la próxima liquidación/);
    const reclamos = within(screen.getByRole('list', { name: 'Reclamos' })).getAllByRole(
      'listitem',
    );
    // Regla 92: el importe, solo el que fue a cargo del propietario.
    expect(reclamos[0]).toHaveTextContent('$ 50.000,00');
    expect(reclamos[1]).not.toHaveTextContent('$');
    expect(screen.getByText('Liquidación 000012 del 10/09/2026')).toBeInTheDocument();
  });

  it('regla 88: pesos y dólares, cada uno con su resumen', async () => {
    getInformePropietario.mockResolvedValue(
      informe({ resumen: [cadena(), cadena({ moneda: 'USD', alquiler: 800, cobrado: 800 })] }),
    );
    solapa();
    expect(await screen.findByRole('list', { name: 'Resumen en USD' })).toHaveTextContent(
      'U$S 800,00',
    );
    expect(screen.getByText('Resumen en pesos')).toBeInTheDocument();
    expect(screen.getByText('Resumen en dólares')).toBeInTheDocument();
  });

  it('regla 94: sin movimientos lo dice, en vez de una cadena en cero', async () => {
    getInformePropietario.mockResolvedValue(
      informe({
        desde: '2026-05',
        hasta: '2026-05',
        resumen: [],
        deuda: [],
        partidas: [],
        reclamos: [],
        liquidaciones: [],
      }),
    );
    solapa({ anio: 2026, periodo: { por: 'mes', mes: 5 } });
    expect(await screen.findByText('Sin movimientos en mayo 2026.')).toBeInTheDocument();
    expect(screen.queryByText('Neto del período')).not.toBeInTheDocument();
    // Sus contratos se siguen viendo.
    expect(screen.getByText('Córdoba 1452 3° B')).toBeInTheDocument();
  });

  it('regla 84: cambiar el período vuelve a pedir el informe, y la dirección lo acompaña', async () => {
    getInformePropietario.mockImplementation(
      async (_t: string, _p: string, q: { desde: string; hasta: string }) => informe(q),
    );
    const replace = vi.spyOn(window.history, 'replaceState');
    solapa();
    await screen.findByRole('list', { name: 'Resumen en ARS' });
    fireEvent.click(screen.getByRole('button', { name: 'Trimestre' }));
    await waitFor(() =>
      expect(getInformePropietario).toHaveBeenLastCalledWith('t', PERSONA, {
        desde: '2026-07',
        hasta: '2026-09',
      }),
    );
    expect(replace).toHaveBeenLastCalledWith(
      null,
      '',
      '/alquileres/personas/p1?solapa=informe&periodo=trimestre&q=3',
    );
  });

  it('regla 95: descarga el PDF y lo manda por mail, del período elegido', async () => {
    getInformePropietario.mockResolvedValue(informe());
    getFichaPersona.mockResolvedValue({
      persona: { id: PERSONA, nombre: 'Marta Propietaria', email: 'marta@mail.com' },
      contactos: [],
    } as unknown as PersonaFichaDto);
    enviarInformePropietarioPorMail.mockResolvedValue({ enviado: true, para: ['marta@mail.com'] });
    solapa();
    await screen.findByRole('list', { name: 'Resumen en ARS' });
    fireEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }));
    expect(abrirPdfEnPestana).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ titulo: 'Informe de septiembre 2026' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Mandar por mail/ }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(await dialogo.findByLabelText(/marta@mail.com/)).toBeChecked();
    fireEvent.click(dialogo.getByRole('button', { name: '✉️ Enviar' }));
    await waitFor(() =>
      expect(enviarInformePropietarioPorMail).toHaveBeenCalledWith(
        't',
        PERSONA,
        { desde: '2026-09', hasta: '2026-09' },
        ['marta@mail.com'],
      ),
    );
  });
});

describe('Informe de propietarios (regla 96)', () => {
  const datos = (over: Partial<InformePropietariosDto> = {}): InformePropietariosDto => ({
    desde: '2026-09',
    hasta: '2026-09',
    hoy: '2026-10-07',
    filas: [
      {
        persona: { id: PERSONA, nombre: 'Marta Propietaria' },
        contratos: 2,
        reclamos: 3,
        monedas: [cadena(), cadena({ moneda: 'USD', cobrado: 800, liquidado: 0, pendiente: 0 })],
      },
      {
        persona: { id: '22222222-2222-4222-8222-222222222222', nombre: 'Pedro Sin Movimientos' },
        contratos: 1,
        reclamos: 0,
        monedas: [],
      },
    ],
    totales: [cadena(), cadena({ moneda: 'USD', cobrado: 800 })],
    ...over,
  });
  const tabla = (d = datos()) =>
    render(
      <InformePropietarios
        datos={d}
        hoy="2026-10-07"
        elegido={{ anio: 2026, periodo: { por: 'mes', mes: 9 } }}
      />,
    );

  it('una fila por propietario, con pesos y dólares por separado y su informe a un toque', () => {
    tabla();
    const fila = screen.getByRole('row', { name: /Marta Propietaria/ });
    expect(fila).toHaveTextContent('$ 1.000.000,00');
    expect(fila).toHaveTextContent('U$S 800,00');
    // Otros descuentos: impuestos + expensas + arreglos + otros.
    expect(fila).toHaveTextContent('$ 92.345,67');
    expect(within(fila).getByRole('link', { name: 'Marta Propietaria' })).toHaveAttribute(
      'href',
      `/alquileres/personas/${PERSONA}?solapa=informe`,
    );
    expect(screen.getByRole('row', { name: /Pedro Sin Movimientos/ })).toHaveTextContent(
      'Sin movimientos',
    );
    // Los totales, uno por moneda (regla 88).
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent('U$S 800,00');
  });

  // Regla 98: sin pendiente negativo; lo que se descuenta en la próxima va debajo, sin otra columna.
  it('lo que se le descuenta en la próxima va debajo del pendiente, sin sumar columnas', () => {
    tabla();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    const fila = screen.getByRole('row', { name: /Marta Propietaria/ });
    expect(fila).toHaveTextContent('a descontar $ 42.345,67');
    expect(fila).not.toHaveTextContent('-$');
    const tarjetas = within(screen.getByRole('list', { name: 'Propietarios' }));
    expect(tarjetas.getByRole('button', { name: /Marta Propietaria/ })).toHaveTextContent(
      'a descontar $ 42.345,67',
    );
  });

  it('en el teléfono, tarjetas que abren el informe con el mismo período', () => {
    render(
      <InformePropietarios
        datos={datos()}
        hoy="2026-10-07"
        elegido={{ anio: 2026, periodo: { por: 'trimestre', q: 3 } }}
      />,
    );
    const tarjetas = within(screen.getByRole('list', { name: 'Propietarios' }));
    fireEvent.click(tarjetas.getByRole('button', { name: /Marta Propietaria/ }));
    expect(push).toHaveBeenCalledWith(
      `/alquileres/personas/${PERSONA}?solapa=informe&periodo=trimestre&q=3`,
    );
  });

  it('cambiar el período pide la tabla de nuevo al servidor', () => {
    tabla();
    fireEvent.click(screen.getByRole('button', { name: 'Año' }));
    expect(push).toHaveBeenCalledWith('/alquileres/personas/p1?periodo=anio', { scroll: false });
  });

  it('sin propietarios en el período, lo dice', () => {
    tabla(datos({ filas: [], totales: [] }));
    expect(
      screen.getByText('Ningún propietario tiene contratos en septiembre 2026.'),
    ).toBeInTheDocument();
  });
});
