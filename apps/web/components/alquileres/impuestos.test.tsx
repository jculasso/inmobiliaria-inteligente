import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  AdelantadoBoletasDto,
  BoletaDto,
  CuentaServicioDto,
  PlanillaBoletasDto,
  PolizaDto,
  PropiedadAlquilerDto,
  ServicioDto,
} from '@vacker/types';

const cargarLoteBoletas = vi.fn();
const pagarBoleta = vi.fn();
const guardarCuentaServicio = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/alquileres-api', () => ({
  cargarLoteBoletas: (...a: unknown[]) => cargarLoteBoletas(...a),
  pagarBoleta: (...a: unknown[]) => pagarBoleta(...a),
  guardarCuentaServicio: (...a: unknown[]) => guardarCuentaServicio(...a),
  anularBoleta: vi.fn(),
  anularPoliza: vi.fn(),
  crearPoliza: vi.fn(),
  borrarCuentaServicio: vi.fn(),
  borrarServicio: vi.fn(),
  cargarServiciosSugeridos: vi.fn(),
  guardarServicio: vi.fn(),
}));

import { PlanillaBoletas } from './boletas-planilla';
import { ImpuestosVista, vistaImpuestos, type DatosImpuestos } from './impuestos-vista';
import { EstadoPoliza } from './polizas';

// Impuestos y servicios, rediseño del 7/10/2026 (spec alquileres-fase-1.md, reglas 45 a 53).

const API = '33333333-3333-4333-8333-333333333333';
const EPE = '66666666-6666-4666-8666-666666666666';
const TGI = '88888888-8888-4888-8888-888888888888';
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const S1 = '99999999-9999-4999-8999-999999999999';
const cuenta = (
  id: string,
  nombre: string,
  over: Partial<CuentaServicioDto> = {},
): CuentaServicioDto => ({
  id,
  propiedad: { id: P1, direccion: 'Mendoza 3340' },
  servicio: { id: `s-${id}`.slice(0, 36), nombre, clase: 'impuesto' },
  numeroCuenta: '12-345',
  aCargoDe: 'inquilino',
  paga: 'inmobiliaria',
  contrato: { id: 'c5', codigo: 'ALT-0005' },
  ...over,
});
const planilla: PlanillaBoletasDto = {
  periodo: '2026-11',
  filas: [
    {
      cuenta: cuenta(API, 'API'),
      cargadas: [],
      anterior: { cuota: '3/6', importe: 45_000, vencimiento: '2026-10-10' },
    },
    { cuenta: cuenta(EPE, 'EPE', { paga: 'inquilino' }), cargadas: [], anterior: null },
  ],
};
const boleta = (over: Partial<BoletaDto> = {}): BoletaDto => ({
  id: crypto.randomUUID(),
  nombre: 'API',
  clase: 'impuesto',
  cuentaId: API,
  polizaId: null,
  numeroCuenta: '12-345',
  propiedad: 'Mendoza 3340',
  contrato: { id: 'c5', codigo: 'ALT-0005' },
  periodo: '2026-10',
  cuota: '4/6',
  vencimiento: '2026-10-25',
  importe: 45_000,
  moneda: 'ARS',
  aCargoDe: 'inquilino',
  paga: 'inmobiliaria',
  estado: 'pendiente',
  pagadaEl: null,
  medio: null,
  registradoPor: 'Operador',
  aplicada: false,
  cargoRecuperado: null,
  ...over,
});
const SIN_ADELANTO: AdelantadoBoletasDto = { porMoneda: [] };
const pagar = (
  over: Partial<Extract<DatosImpuestos, { ver: 'pagar' }>> = {},
  periodo = '2026-10',
) =>
  render(
    <ImpuestosVista
      periodo={periodo}
      datos={{ ver: 'pagar', boletas: [], control: [], adelantado: SIN_ADELANTO, ...over }}
    />,
  );
const tarjeta = (titulo: string) =>
  screen.getByText(titulo, { selector: 'p' }).closest('.rounded-brand')! as HTMLElement;
const tabla = (titulo: string) => within(screen.getByRole('table', { name: titulo }));

describe('regla 45: tres pestañas', () => {
  it('regla 45: «Para pagar», «Cargar el mes» y «Qué tiene cada propiedad», cada una por ?ver=', () => {
    pagar();
    const pestañas = within(screen.getByRole('group', { name: 'Qué hacer' }));
    expect(pestañas.getByRole('link', { name: 'Para pagar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(pestañas.getByRole('link', { name: 'Cargar el mes' })).toHaveAttribute(
      'href',
      '?periodo=2026-10&ver=cargar',
    );
    expect(pestañas.getByRole('link', { name: 'Qué tiene cada propiedad' })).toHaveAttribute(
      'href',
      '?periodo=2026-10&ver=propiedades',
    );
  });

  it('regla 45: cambiar de mes no saca de la pestaña', () => {
    render(<ImpuestosVista periodo="2026-11" datos={{ ver: 'cargar', planilla }} />);
    expect(screen.getByRole('link', { name: 'Mes siguiente' })).toHaveAttribute(
      'href',
      '?periodo=2026-12&ver=cargar',
    );
  });

  it('regla 45: lo desconocido y el «?ver=control» de antes abren «Para pagar»', () => {
    expect(vistaImpuestos(undefined)).toBe('pagar');
    expect(vistaImpuestos('control')).toBe('pagar');
    expect(vistaImpuestos('mes')).toBe('pagar');
    expect(vistaImpuestos('cargar')).toBe('cargar');
    expect(vistaImpuestos('propiedades')).toBe('propiedades');
  });

  it('regla 45: las pólizas no están en esta pantalla; sus cuotas, sí, como boletas para pagar', () => {
    pagar({
      boletas: [
        boleta({
          nombre: 'Póliza Sancor N° 123',
          clase: 'poliza',
          cuentaId: null,
          polizaId: 'p1',
          numeroCuenta: null,
          cuota: '2/3',
        }),
      ],
    });
    expect(screen.queryByText(/Pólizas de seguro/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Póliza Sancor N° 123 · cuota 2 de 3').length).toBeGreaterThan(0);
  });
});

describe('«Para pagar» (reglas 46 a 50)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00Z')); // mié 07/10, en la Argentina
  });
  afterEach(() => vi.useRealTimers());

  const vencida = boleta({
    vencimiento: '2026-10-06',
    importe: 10_000,
    cuota: '10/12',
    nombre: 'TGI',
  });
  const semana = boleta({ vencimiento: '2026-10-09', importe: 45_000 });
  const adelante = boleta({
    vencimiento: '2026-10-25',
    importe: 30_000,
    nombre: 'EPE',
    paga: 'inquilino',
    cuota: null,
  });
  const pagada = boleta({
    vencimiento: '2026-10-01',
    estado: 'pagada',
    pagadaEl: '2026-10-02',
    aCargoDe: 'propietario',
    cargoRecuperado: false,
    nombre: 'Expensas',
    cuota: null,
  });
  const anulada = boleta({ estado: 'anulada', nombre: 'Agua', cuota: null });

  it('regla 48: agrupa en Vencidas, Esta semana, Más adelante en octubre y Pagadas de octubre', () => {
    pagar({ control: [vencida, semana], boletas: [vencida, semana, adelante, pagada, anulada] });
    expect(tabla('Vencidas').getByText('TGI · cuota 10 de 12')).toBeInTheDocument();
    expect(tabla('Vencidas').getByText('venció el mar 06/10')).toBeInTheDocument();
    expect(tabla('Esta semana').getByText('vence el vie 09/10')).toBeInTheDocument();
    expect(tabla('Más adelante en octubre').getByText('EPE')).toBeInTheDocument();
    expect(tabla('Pagadas de octubre').getByText('Expensas')).toBeInTheDocument();
    // La anulada no se mezcla: queda detrás de «Ver anuladas».
    expect(screen.queryByRole('table', { name: 'Anuladas de octubre' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver anuladas de octubre (1)' }));
    expect(tabla('Anuladas de octubre').getByText('Agua')).toBeInTheDocument();
  });

  it('regla 46: cada fila dice qué pasa con la plata, y el botón dice qué se registra', () => {
    pagar({ control: [semana], boletas: [semana, adelante] });
    const s = tabla('Esta semana');
    expect(
      s.getByText('La paga la inmobiliaria y se le cobra al inquilino en su próximo recibo'),
    ).toBeInTheDocument();
    expect(s.getByRole('button', { name: 'Registrar pago de API' })).toHaveTextContent(
      'Registrar pago',
    );
    const a = tabla('Más adelante en octubre');
    expect(
      a.getByText('La paga el inquilino: solo hay que pedirle el comprobante'),
    ).toBeInTheDocument();
    expect(a.getByRole('button', { name: 'Trajo el comprobante de EPE' })).toHaveTextContent(
      'Trajo el comprobante',
    );
  });

  it('regla 46: sin contrato ese mes, la fila lo dice', () => {
    pagar({ boletas: [boleta({ contrato: null })] });
    expect(
      tabla('Más adelante en octubre').getByText(
        'Sin contrato ese mes: no se le carga a nadie, queda para control',
      ),
    ).toBeInTheDocument();
  });

  it('regla 47: ya pagada, la fila dice si se recuperó', () => {
    pagar({
      boletas: [
        pagada,
        {
          ...pagada,
          id: crypto.randomUUID(),
          nombre: 'API',
          cargoRecuperado: true,
          aCargoDe: 'inquilino',
        },
      ],
    });
    const p = tabla('Pagadas de octubre');
    expect(
      p.getByText('Falta descontárselo al propietario: va en su próxima liquidación'),
    ).toBeInTheDocument();
    expect(p.getByText('Ya se le cobró al inquilino')).toBeInTheDocument();
  });

  it('regla 48: «cargó X» no se repite en cada fila: queda en el title', () => {
    pagar({ boletas: [adelante] });
    expect(screen.queryByText(/cargó Operador/)).not.toBeInTheDocument();
    expect(tabla('Más adelante en octubre').getByText('EPE').closest('tr')).toHaveAttribute(
      'title',
      'Cargó Operador',
    );
  });

  // Antes, «Paga la inmobiliaria, a 7 días» sumaba también las vencidas.
  it('regla 49: «Vencen esta semana» no suma las vencidas; «Vencidas» las suma de cualquier mes', () => {
    const deAgosto = boleta({ vencimiento: '2026-08-10', periodo: '2026-08', importe: 5_000 });
    pagar({ control: [deAgosto, vencida, semana], boletas: [vencida, semana, adelante] });
    expect(tarjeta('Vencen esta semana')).toHaveTextContent('$ 45.000,00');
    expect(tarjeta('Vencen esta semana')).toHaveTextContent('1 boleta');
    expect(tarjeta('Vencidas')).toHaveTextContent('$ 15.000,00');
    expect(tarjeta('Vencidas')).toHaveTextContent('2 boletas');
  });

  it('regla 49: «Comprobantes que faltan» cuenta las vencidas que paga una parte', () => {
    pagar({
      control: [vencida, boleta({ vencimiento: '2026-10-05', paga: 'inquilino' }), semana],
    });
    expect(tarjeta('Comprobantes que faltan')).toHaveTextContent('1');
  });

  it('regla 50: «Adelantado sin recuperar» muestra lo que da la API, por moneda', () => {
    pagar({
      adelantado: {
        porMoneda: [
          { moneda: 'ARS', importe: 55_000, boletas: 2 },
          { moneda: 'USD', importe: 120, boletas: 1 },
        ],
      },
    });
    const t = tarjeta('Adelantado sin recuperar');
    expect(t).toHaveTextContent('$ 55.000,00');
    expect(t).toHaveTextContent('U$S 120,00');
    expect(t).toHaveTextContent('3 boletas que pagó la inmobiliaria');
  });

  it('regla 48: anular es secundario, y lo ya cobrado o liquidado no lo ofrece', () => {
    pagar({ boletas: [boleta({ aplicada: true })] });
    expect(
      tabla('Más adelante en octubre').queryByRole('button', { name: 'Anular API' }),
    ).not.toBeInTheDocument();
  });

  it('registrar el pago manda fecha y medio', async () => {
    pagar({ boletas: [semana] });
    fireEvent.click(tabla('Esta semana').getByRole('button', { name: 'Registrar pago de API' }));
    fireEvent.change(screen.getByLabelText('Medio'), { target: { value: 'efectivo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar el pago' }));
    await waitFor(() =>
      expect(pagarBoleta).toHaveBeenCalledWith('token', semana.id, '2026-10-07', 'efectivo'),
    );
  });

  it('sin nada pendiente ni del mes, lleva a cargar las boletas', () => {
    pagar();
    expect(screen.getByRole('link', { name: 'Cargar las boletas del mes' })).toHaveAttribute(
      'href',
      '?periodo=2026-10&ver=cargar',
    );
  });
});

describe('«Cargar el mes» (reglas 51 y 52)', () => {
  it('regla 52: tabla con títulos por propiedad, la cuota en dos campitos y el importe del mes anterior', () => {
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Impuesto',
      'Cuota',
      'Vence',
      'Importe',
    ]);
    expect(screen.getByRole('rowheader')).toHaveTextContent('Mendoza 3340 · ALT-0005');
    expect(screen.getByText('En octubre: $ 45.000,00 (cuota 3 de 6)')).toBeInTheDocument();
    expect(screen.getByText('Sin boleta en octubre')).toBeInTheDocument();
    expect(screen.getByLabelText('Total de cuotas de API de Mendoza 3340')).toBeInTheDocument();
  });

  it('regla 51: «Completar con octubre»: cuota siguiente en dos campos, un mes después; se guarda «4/6»', async () => {
    cargarLoteBoletas.mockResolvedValueOnce({ creadas: 1, repetidas: 0, sinContrato: 0 });
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    fireEvent.click(screen.getByRole('button', { name: /Completar con octubre/ }));
    expect(screen.getByLabelText('Cuota de API de Mendoza 3340')).toHaveValue('4');
    expect(screen.getByLabelText('Total de cuotas de API de Mendoza 3340')).toHaveValue('6');
    expect(screen.getByLabelText('Vencimiento de API de Mendoza 3340')).toHaveValue('2026-11-10');
    expect(screen.getByLabelText('Importe de EPE de Mendoza 3340')).toHaveValue('');
    expect(screen.getByText(/1 boleta para guardar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar 1 boleta' }));
    await waitFor(() =>
      expect(cargarLoteBoletas).toHaveBeenCalledWith('token', {
        periodo: '2026-11',
        boletas: [{ cuentaId: API, cuota: '4/6', vencimiento: '2026-11-10', importe: 45_000 }],
      }),
    );
  });

  // Prueba en producción, 7/10/2026: «Se cargó 1 boleta» al lado de «0 boletas · $ 0,00» y Guardar apagado.
  it('regla 52: después de guardar, el aviso no convive con un contador en cero', async () => {
    cargarLoteBoletas.mockResolvedValueOnce({ creadas: 1, repetidas: 0, sinContrato: 0 });
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    fireEvent.click(screen.getByRole('button', { name: /Completar con octubre/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar 1 boleta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Se guardó 1 boleta.');
    expect(screen.queryByText(/0 boletas/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument();
    // Lo que se escribe después es otra tanda: el aviso se va y vuelve el contador.
    fireEvent.change(screen.getByLabelText('Importe de EPE de Mendoza 3340'), {
      target: { value: '30.000' },
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar 1 boleta' })).toBeInTheDocument();
  });

  it('una fila con importe y sin vencimiento no se guarda: dice cuál', async () => {
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    fireEvent.change(screen.getByLabelText('Importe de EPE de Mendoza 3340'), {
      target: { value: '30.000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar 1 boleta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'EPE de Mendoza 3340: falta el vencimiento.',
    );
    expect(cargarLoteBoletas).toHaveBeenCalledTimes(2);
  });

  it('regla 51: una cuota con un solo número se avisa, con un solo punto', async () => {
    render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    fireEvent.change(screen.getByLabelText('Importe de EPE de Mendoza 3340'), {
      target: { value: '30.000' },
    });
    fireEvent.change(screen.getByLabelText('Vencimiento de EPE de Mendoza 3340'), {
      target: { value: '2026-11-10' },
    });
    fireEvent.change(screen.getByLabelText('Cuota de EPE de Mendoza 3340'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar 1 boleta' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'EPE de Mendoza 3340: la cuota va con los dos números, por ejemplo «3 de 6».',
    );
    expect(alerta.textContent).not.toMatch(/\.\.$/);
  });

  it('regla 52: lo ya cargado se ve como tal, y se puede cargar otra boleta del mismo impuesto', () => {
    render(
      <PlanillaBoletas
        planilla={{
          ...planilla,
          filas: [
            {
              ...planilla.filas[0]!,
              cargadas: [
                {
                  id: TGI,
                  cuota: '4/6',
                  importe: 45_000,
                  vencimiento: '2026-11-10',
                  estado: 'pendiente',
                },
              ],
            },
          ],
        }}
        mes="noviembre de 2026"
      />,
    );
    expect(
      screen.getByText(/✓ Ya cargada \(cuota 4 de 6\): \$ 45\.000,00,\s+vence 10\/11/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Importe de API de Mendoza 3340')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Cargar otra boleta de API de Mendoza 3340' }),
    );
    expect(screen.getByLabelText('Importe de API de Mendoza 3340')).toBeInTheDocument();
  });

  it('regla 53: sin impuestos asignados, lleva a «Qué tiene cada propiedad»; sin «cuenta» como jerga', () => {
    const { unmount } = render(
      <PlanillaBoletas planilla={{ periodo: '2026-11', filas: [] }} mes="noviembre de 2026" />,
    );
    expect(
      screen.getByRole('link', { name: 'Asignalos en «Qué tiene cada propiedad»' }),
    ).toHaveAttribute('href', '?periodo=2026-11&ver=propiedades');
    unmount();
    // Antes decía «2 cuentas» y «Cuenta 12-345».
    const { container } = render(<PlanillaBoletas planilla={planilla} mes="noviembre de 2026" />);
    expect(container.textContent).not.toMatch(/cuenta/i);
  });
});

describe('«Qué tiene cada propiedad» (reglas 46 y 53)', () => {
  const servicios: ServicioDto[] = [{ id: S1, nombre: 'API', clase: 'impuesto', cuentas: 1 }];
  const propiedad = (id: string, direccion: string): PropiedadAlquilerDto => ({
    id,
    direccion,
    unidad: null,
    ciudad: null,
    tipo: null,
    obs: null,
  });
  const propiedades = () =>
    render(
      <ImpuestosVista
        periodo="2026-10"
        datos={{
          ver: 'propiedades',
          cuentas: [cuenta(API, 'API')],
          servicios,
          propiedades: [propiedad(P1, 'Mendoza 3340'), propiedad(P2, 'Córdoba 1200')],
        }}
      />,
    );

  it('regla 53: las propiedades sin ningún impuesto también aparecen, con «Asignar»', () => {
    propiedades();
    expect(screen.getByText('Córdoba 1200')).toBeInTheDocument();
    expect(screen.getByText('Sin impuestos ni servicios asignados.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Asignar un impuesto a Córdoba 1200' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('La paga la inmobiliaria y se le cobra al inquilino en su próximo recibo'),
    ).toBeInTheDocument();
  });

  it('regla 46: el alta tiene un solo campo con las seis frases, y guarda quién la debe y quién la paga', async () => {
    guardarCuentaServicio.mockResolvedValueOnce({ id: 'x' });
    propiedades();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar un impuesto a Córdoba 1200' }));
    const campo = screen.getByLabelText('Quién la paga y a quién se le carga');
    expect(within(campo).getAllByRole('option')).toHaveLength(6);
    expect(screen.queryByLabelText('La debe')).not.toBeInTheDocument();
    fireEvent.change(campo, { target: { value: 'propietario|inquilino' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(guardarCuentaServicio).toHaveBeenCalledWith('token', null, {
        propiedadId: P2,
        servicioId: S1,
        numeroCuenta: '',
        aCargoDe: 'propietario',
        paga: 'inquilino',
      }),
    );
  });
});

describe('Pólizas (en la ficha del contrato)', () => {
  it('una póliza: vigente, por vencer en 60 días, vencida o anulada', () => {
    const p = (hasta: string, anulada = false) =>
      ({ id: crypto.randomUUID(), hasta, anulada }) as PolizaDto;
    const hoy = new Date(Date.now() - 3 * 3600 * 1000);
    const en = (dias: number) =>
      new Date(hoy.getTime() + dias * 86_400_000).toISOString().slice(0, 10);
    const { rerender } = render(<EstadoPoliza p={p(en(200))} />);
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    rerender(<EstadoPoliza p={p(en(30))} />);
    expect(screen.getByText(/^Vence el/)).toBeInTheDocument();
    rerender(<EstadoPoliza p={p(en(-1))} />);
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    rerender(<EstadoPoliza p={p(en(30), true)} />);
    expect(screen.getByText('Anulada')).toBeInTheDocument();
  });
});
