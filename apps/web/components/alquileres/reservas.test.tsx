import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ContratoResumenDto,
  InventarioDto,
  PersonaDto,
  PropiedadAlquilerDto,
  ReservaDto,
  ReservaResumenDto,
} from '@vacker/types';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/alquileres/reservas',
}));
vi.mock('../../lib/supabase/client', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('../../lib/refrescar', () => ({
  useRefrescar: () => ({ refrescar: vi.fn().mockResolvedValue(undefined), refrescando: false }),
}));
const crearReserva = vi.fn();
const cambiarEstadoReserva = vi.fn();
const guardarInventario = vi.fn();
const convertirReserva = vi.fn();
const cobrarSenaReserva = vi.fn();
const generarAnexoInventario = vi.fn();
vi.mock('../../lib/reservas-api', () => ({
  cobrarSenaReserva: (...a: unknown[]) => cobrarSenaReserva(...a),
  generarAnexoInventario: (...a: unknown[]) => generarAnexoInventario(...a),
  crearReserva: (...a: unknown[]) => crearReserva(...a),
  actualizarReserva: vi.fn(),
  cambiarEstadoReserva: (...a: unknown[]) => cambiarEstadoReserva(...a),
  guardarGarantiasReserva: vi.fn(),
  guardarInventario: (...a: unknown[]) => guardarInventario(...a),
  convertirReserva: (...a: unknown[]) => convertirReserva(...a),
}));
const crearPersona = vi.fn();
const crearContrato = vi.fn();
vi.mock('../../lib/alquileres-api', () => ({
  crearPersona: (...a: unknown[]) => crearPersona(...a),
  actualizarPersona: vi.fn(),
  crearContrato: (...a: unknown[]) => crearContrato(...a),
  actualizarContrato: vi.fn(),
  guardarGarantias: vi.fn(),
  generarRecibo: vi.fn(),
  enviarReciboPorMail: vi.fn(),
  generarDesdePlantilla: vi.fn(),
}));
const descargarArchivo = vi.fn();
vi.mock('../../lib/descargar-archivo', () => ({
  descargarArchivo: (...a: unknown[]) => descargarArchivo(...a),
}));

import { ReservasLista } from './reservas-lista';
import { ReservaForm } from './reserva-form';
import { ReservaFicha } from './reserva-ficha';
import { InventarioContrato } from './inventario-contrato';
import { ReservaDelContrato } from './reserva-del-contrato';
import { ContratoForm } from './contrato-form';
import { contratoDesdeReserva } from '../../lib/reserva-a-contrato';
import { PropiedadesLista } from './propiedades-lista';
import { SenaComoDeposito } from './sena-como-deposito';
import { GenerarContrato } from './generar-contrato';

const persona = (id: string, nombre: string): PersonaDto => ({
  id,
  tipo: 'fisica',
  nombre,
  documento: null,
  email: null,
  telefono: null,
  domicilio: null,
  obs: null,
  cuit: null,
  condicionIva: null,
  localidad: null,
  provincia: null,
  codigoPostal: null,
  fechaNacimiento: null,
  nacionalidad: null,
  estadoCivil: null,
});
const DUENA = persona('22222222-2222-4222-8222-222222222222', 'Marta Propietaria');
const ANA = persona('33333333-3333-4333-8333-333333333333', 'Ana Interesada');
const CARLOS = persona('44444444-4444-4444-8444-444444444444', 'Carlos Garante');
const PROP: PropiedadAlquilerDto = {
  id: '11111111-1111-4111-8111-111111111111',
  direccion: 'Mitre 100',
  unidad: '2° A',
  ciudad: 'Rosario',
  tipo: 'vivienda',
  obs: null,
};
const RID = '55555555-5555-4555-8555-555555555555';

const resumen = (over: Partial<ReservaResumenDto> = {}): ReservaResumenDto => ({
  id: RID,
  numero: 1,
  estado: 'reservada',
  tipo: 'vivienda',
  fecha: '2026-10-10',
  vence: '2026-10-12',
  propiedad: { id: PROP.id, direccion: PROP.direccion, unidad: PROP.unidad },
  interesados: [{ id: ANA.id, nombre: ANA.nombre }],
  sena: {
    importe: 500,
    moneda: 'USD',
    recibida: true,
    recibidaEl: '2026-10-10',
    medio: 'transferencia',
    recibo: { id: '88888888-8888-4888-8888-888888888888', numero: 123 },
  },
  contrato: null,
  ...over,
});

const reserva = (over: Partial<ReservaDto> = {}): ReservaDto => ({
  ...resumen(),
  propiedad: { id: PROP.id, direccion: PROP.direccion, unidad: PROP.unidad, ciudad: 'Rosario' },
  partes: [
    { personaId: ANA.id, nombre: ANA.nombre, papel: 'inquilino' },
    { personaId: DUENA.id, nombre: DUENA.nombre, papel: 'propietario' },
    { personaId: CARLOS.id, nombre: CARLOS.nombre, papel: 'garante' },
  ],
  moneda: 'ARS',
  alquilerInicial: 600_000,
  inicio: '2026-11-01',
  duracionMeses: 24,
  ajuste: 'indexado',
  indice: 'ICL',
  periodicidadMeses: 3,
  depositoImporte: 600,
  depositoMoneda: 'USD',
  obs: null,
  motivo: null,
  senaRetenida: null,
  registrado: { en: '2026-10-10T13:00:00Z', por: 'Lucía' },
  garantias: [],
  historial: [],
  ...over,
});

beforeEach(() => {
  push.mockReset();
  crearReserva.mockReset();
  cambiarEstadoReserva.mockReset();
  guardarInventario.mockReset();
  convertirReserva.mockReset();
  crearPersona.mockReset();
});

describe('ReservasLista (regla 164)', () => {
  it('marca en rojo la que venció abierta, con los días', () => {
    render(<ReservasLista reservas={[resumen()]} filtro="abiertas" hoy="2026-10-15" />);
    const tabla = screen.getByRole('table');
    const celda = within(tabla).getByText(/vencida hace 3 días/);
    // En rojo de peligro, nunca en el color de la marca (CONVENCIONES §13).
    expect(celda.closest('.text-danger')).not.toBeNull();
    expect(within(tabla).getByText('recibida el 10/10/2026')).toBeInTheDocument();
  });

  it('una cerrada no se marca vencida aunque la fecha haya pasado', () => {
    render(
      <ReservasLista reservas={[resumen({ estado: 'anulada' })]} filtro="todas" hoy="2026-10-15" />,
    );
    expect(screen.queryByText(/vencida hace/)).not.toBeInTheDocument();
  });

  it('el filtro lleva el estado a la dirección; las abiertas no escriben nada', async () => {
    render(<ReservasLista reservas={[resumen()]} filtro="abiertas" hoy="2026-10-15" />);
    await userEvent.selectOptions(screen.getByLabelText('Qué reservas'), 'aprobada');
    expect(push).toHaveBeenLastCalledWith('/alquileres/reservas?estado=aprobada');
    await userEvent.selectOptions(screen.getByLabelText('Qué reservas'), 'abiertas');
    expect(push).toHaveBeenLastCalledWith('/alquileres/reservas');
  });

  it('vacías, dice por qué', () => {
    render(<ReservasLista reservas={[]} filtro="abiertas" hoy="2026-10-15" />);
    expect(screen.getByText('No hay reservas abiertas.')).toBeInTheDocument();
  });
});

describe('ReservaForm (regla 154)', () => {
  const contratoDeLaPropiedad = {
    id: 'k',
    codigo: 'ALT-0001',
    estado: 'vigente',
    inicio: '2024-01-01',
    propiedad: { id: PROP.id, direccion: PROP.direccion, unidad: PROP.unidad },
    propietarios: [{ id: DUENA.id, nombre: DUENA.nombre }],
    inquilinos: [],
  } as unknown as ContratoResumenDto;

  it('da de alta al interesado sin salir del formulario y lo deja elegido', async () => {
    crearPersona.mockResolvedValueOnce(
      persona('66666666-6666-4666-8666-666666666666', 'Nuevo Interesado'),
    );
    render(<ReservaForm personas={[DUENA]} propiedades={[PROP]} contratos={[]} />);
    await userEvent.selectOptions(screen.getByLabelText('Persona (interesado)'), '__nueva__');
    const modal = await screen.findByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/Nombre/), 'Nuevo Interesado');
    await userEvent.click(within(modal).getByRole('button', { name: /Guardar/ }));
    await waitFor(() =>
      expect(screen.getByLabelText('Persona (interesado)')).toHaveValue(
        '66666666-6666-4666-8666-666666666666',
      ),
    );
  });

  it('al elegir la propiedad propone los propietarios de su último contrato', async () => {
    render(
      <ReservaForm
        personas={[DUENA, ANA]}
        propiedades={[PROP]}
        contratos={[contratoDeLaPropiedad]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText(/Propiedad/), PROP.id);
    expect(screen.getByLabelText('Persona (propietario)')).toHaveValue(DUENA.id);
  });

  it('la seña se acuerda acá (importe y moneda); se cobra después, desde la ficha', async () => {
    crearReserva.mockResolvedValueOnce({ id: RID });
    render(<ReservaForm personas={[ANA]} propiedades={[PROP]} contratos={[]} />);
    await userEvent.selectOptions(screen.getByLabelText(/Propiedad/), PROP.id);
    await userEvent.selectOptions(screen.getByLabelText('Persona (interesado)'), ANA.id);
    await userEvent.type(screen.getByLabelText(/^Seña/), '500');
    await userEvent.selectOptions(screen.getByLabelText('Moneda de la seña'), 'USD');
    expect(screen.queryByLabelText('La seña ya se recibió')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar la reserva' }));
    await waitFor(() => expect(crearReserva).toHaveBeenCalled());
    expect(crearReserva.mock.calls[0]![1]).toMatchObject({
      propiedadId: PROP.id,
      partes: [{ personaId: ANA.id, papel: 'inquilino' }],
      senaImporte: 500,
      senaMoneda: 'USD',
    });
    expect(push).toHaveBeenCalledWith(`/alquileres/reservas/${RID}`);
  });

  it('regla 169: con el recibo hecho, la seña no se cambia desde el formulario', () => {
    render(
      <ReservaForm
        personas={[ANA, DUENA, CARLOS]}
        propiedades={[PROP]}
        contratos={[]}
        reserva={reserva()}
      />,
    );
    expect(screen.getByLabelText(/^Seña/)).toBeDisabled();
    expect(screen.getByText(/Ya se cobró: recibo 000123/)).toBeInTheDocument();
  });
});

describe('ReservaFicha (reglas 155, 157 y 159)', () => {
  const botones = () => screen.getAllByRole('button').map((b) => b.textContent);

  it('reservada: empezar el estudio y anular; «vencida» solo después del vencimiento', () => {
    const { unmount } = render(<ReservaFicha reserva={reserva()} hoy="2026-10-12" />);
    expect(botones()).toEqual(
      expect.arrayContaining(['🔎 Empezar el estudio de garantías', '🚫 Anular']),
    );
    expect(botones()).not.toContain('Dar por vencida');
    expect(botones()).not.toContain('✅ Aprobar');
    unmount();
    render(<ReservaFicha reserva={reserva()} hoy="2026-10-13" />);
    expect(botones()).toContain('Dar por vencida');
  });

  it('en estudio: aprobar o rechazar; rechazar pide el motivo', async () => {
    cambiarEstadoReserva.mockResolvedValueOnce({});
    render(<ReservaFicha reserva={reserva({ estado: 'en_estudio' })} hoy="2026-10-12" />);
    expect(botones()).toEqual(expect.arrayContaining(['✅ Aprobar', 'Rechazar']));
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const modal = await screen.findByRole('dialog');
    const confirmar = within(modal).getByRole('button', { name: 'Rechazar' });
    expect(confirmar).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText(/Motivo/), 'Sin ingresos demostrables');
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(cambiarEstadoReserva).toHaveBeenCalledWith('token', RID, {
        estado: 'rechazada',
        motivo: 'Sin ingresos demostrables',
      }),
    );
  });

  it('aprobada: «Convertir en contrato» y ya no se cargan garantías', () => {
    render(<ReservaFicha reserva={reserva({ estado: 'aprobada' })} hoy="2026-10-12" />);
    expect(screen.getByRole('link', { name: '📄 Convertir en contrato' })).toHaveAttribute(
      'href',
      `/alquileres/reservas/${RID}/convertir`,
    );
    expect(screen.queryByRole('button', { name: /Agregar garantías/ })).not.toBeInTheDocument();
  });

  it('convertida: el enlace al contrato y ningún paso', () => {
    render(
      <ReservaFicha
        reserva={reserva({ estado: 'convertida', contrato: { id: 'k1', codigo: 'ALT-0012' } })}
        hoy="2026-10-12"
      />,
    );
    expect(screen.getByRole('link', { name: 'ALT-0012' })).toHaveAttribute(
      'href',
      '/alquileres/contratos/k1',
    );
    expect(screen.queryByRole('button', { name: /Anular|Aprobar|Editar/ })).not.toBeInTheDocument();
  });
});

describe('Convertir en contrato (regla 159)', () => {
  it('precarga partes, fechas, tramos con el alquiler inicial y el depósito en su moneda', () => {
    const p = contratoDesdeReserva(reserva({ estado: 'aprobada' }));
    expect(p).toMatchObject({
      propiedad: { id: PROP.id },
      inicio: '2026-11-01',
      fin: '2028-10-31',
      indice: 'ICL',
      periodicidadMeses: 3,
      depositoImporte: 600,
      depositoMoneda: 'USD',
    });
    expect(p.partes.map((x) => x.papel)).toEqual(['inquilino', 'propietario', 'garante']);
    expect(p.tramos).toHaveLength(8);
    expect(p.tramos[0]).toMatchObject({ desde: '2026-11-01', importe: 600_000 });
    expect(p.tramos[1]!.importe).toBeNull();
    expect(p.tramos.at(-1)!.hasta).toBe('2028-10-31');
  });

  it('el alta precargada guarda por la reserva, con el depósito en dólares', async () => {
    convertirReserva.mockResolvedValueOnce({ id: 'k1' });
    const r = reserva({ estado: 'aprobada' });
    render(
      <ContratoForm
        personas={[DUENA, ANA, CARLOS]}
        propiedades={[PROP]}
        desdeReserva={{ id: r.id, numero: r.numero, precarga: contratoDesdeReserva(r) }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Contrato desde la reserva 1' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Propiedad/)).toHaveValue(PROP.id);
    await userEvent.click(screen.getByRole('button', { name: /Condiciones/ }));
    expect(screen.getByLabelText('Moneda del depósito')).toHaveValue('USD');
    await userEvent.click(screen.getByRole('button', { name: /Tramos/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar en borrador' }));
    await waitFor(() => expect(convertirReserva).toHaveBeenCalled());
    expect(crearContrato).not.toHaveBeenCalled();
    expect(convertirReserva.mock.calls[0]![1]).toBe(RID);
    expect(convertirReserva.mock.calls[0]![2]).toMatchObject({
      propiedadId: PROP.id,
      depositoImporte: 600,
      depositoMoneda: 'USD',
      inicio: '2026-11-01',
      fin: '2028-10-31',
    });
    expect(push).toHaveBeenCalledWith('/alquileres/contratos/k1');
  });
});

describe('Inventario del contrato (reglas 150 y 151)', () => {
  const vacio: InventarioDto = { items: [], observaciones: null, editable: true };

  it('carga ítems: la cantidad vacía es 1 y un renglón en blanco no se manda', async () => {
    guardarInventario.mockResolvedValueOnce(vacio);
    render(<InventarioContrato contratoId="k1" inventario={vacio} />);
    await userEvent.click(screen.getByRole('button', { name: '＋ Cargar inventario' }));
    await userEvent.type(screen.getByLabelText('Descripción, ítem 1'), 'Heladera');
    await userEvent.clear(screen.getByLabelText('Cantidad, ítem 1'));
    await userEvent.click(screen.getByRole('button', { name: '＋ Agregar ítem' }));
    await userEvent.type(screen.getByLabelText(/Observaciones/), 'Con llave del portón.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(guardarInventario).toHaveBeenCalledWith('token', 'k1', {
        items: [{ descripcion: 'Heladera', cantidad: 1, estado: null }],
        observaciones: 'Con llave del portón.',
      }),
    );
  });

  it('un estado sin descripción no se guarda: lo dice', async () => {
    render(<InventarioContrato contratoId="k1" inventario={vacio} />);
    await userEvent.click(screen.getByRole('button', { name: '＋ Cargar inventario' }));
    await userEvent.type(screen.getByLabelText('Estado, ítem 1'), 'Rota');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cada ítem del inventario lleva su descripción.',
    );
    expect(guardarInventario).not.toHaveBeenCalled();
  });

  it('regla 151: en un contrato que ya no lo admite, se ve sin el botón', () => {
    render(
      <InventarioContrato
        contratoId="k1"
        inventario={{
          items: [{ descripcion: 'Heladera', cantidad: 1, estado: 'Funcionando' }],
          observaciones: null,
          editable: false,
        }}
      />,
    );
    expect(screen.getByText('Heladera')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });
});

describe('ReservaDelContrato (regla 161)', () => {
  it('muestra la seña de la reserva y enlaza la reserva', () => {
    render(
      <ReservaDelContrato
        reserva={{
          id: RID,
          numero: 3,
          sena: {
            importe: 500,
            moneda: 'USD',
            recibida: false,
            recibidaEl: null,
            medio: null,
            recibo: null,
          },
        }}
      />,
    );
    expect(screen.getByText(/Seña de la reserva 3:/).parentElement).toHaveTextContent(
      'Seña de la reserva 3: U$S 500,00 · sin recibir.',
    );
    expect(screen.getByRole('link', { name: 'reserva 3' })).toHaveAttribute(
      'href',
      `/alquileres/reservas/${RID}`,
    );
  });

  it('un contrato que no salió de una reserva no muestra nada', () => {
    const { container } = render(<ReservaDelContrato reserva={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PropiedadesLista (regla 165)', () => {
  it('marca «Reservada» a la que tiene una reserva abierta, y abre la reserva', () => {
    const otra = { ...PROP, id: '77777777-7777-4777-8777-777777777777', direccion: 'Otra 1' };
    render(<PropiedadesLista propiedades={[PROP, otra]} reservas={[resumen({ numero: 3 })]} />);
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByRole('link', { name: '🔖 Reservada · Reserva 3' })).toHaveAttribute(
      'href',
      `/alquileres/reservas/${RID}`,
    );
    expect(tabla.getAllByRole('link', { name: /Reservada/ })).toHaveLength(1);
  });
});

describe('La seña en la ficha (reglas 169 a 172)', () => {
  const sinCobrar = () =>
    reserva({
      sena: {
        importe: 500,
        moneda: 'USD',
        recibida: false,
        recibidaEl: null,
        medio: null,
        recibo: null,
      },
    });

  it('regla 169: «Cobrar la seña» hace el recibo a nombre del interesado', async () => {
    cobrarSenaReserva.mockResolvedValueOnce({});
    render(<ReservaFicha reserva={sinCobrar()} hoy="2026-10-12" />);
    await userEvent.click(screen.getByRole('button', { name: '💵 Cobrar la seña' }));
    const modal = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(modal).getByLabelText(/Medio/), 'efectivo');
    await userEvent.click(within(modal).getByRole('button', { name: 'Cobrar y hacer el recibo' }));
    await waitFor(() => expect(cobrarSenaReserva).toHaveBeenCalled());
    expect(cobrarSenaReserva.mock.calls[0]![1]).toBe(RID);
    expect(cobrarSenaReserva.mock.calls[0]![2]).toMatchObject({
      medio: 'efectivo',
      personaId: ANA.id,
    });
  });

  it('regla 169: cobrada, muestra el recibo con su PDF y «Mandar por mail»; no se cobra de nuevo', () => {
    render(<ReservaFicha reserva={reserva()} hoy="2026-10-12" />);
    expect(screen.getByRole('button', { name: '🧾 Recibo 000123' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✉️ Mandar por mail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '💵 Cobrar la seña' })).not.toBeInTheDocument();
  });

  it('regla 171: «No se presentó a firmar» avisa que la seña va al propietario', async () => {
    render(<ReservaFicha reserva={reserva({ estado: 'aprobada' })} hoy="2026-10-12" />);
    await userEvent.click(screen.getByRole('button', { name: 'No se presentó a firmar' }));
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent(
      'La seña de U$S 500,00 se retiene y se le entrega a Marta Propietaria en su próxima liquidación.',
    );
  });

  it('regla 171: sin propietario cargado, pide a quién entregársela', async () => {
    cambiarEstadoReserva.mockResolvedValueOnce({});
    const sinDueno = reserva({
      estado: 'aprobada',
      partes: [{ personaId: ANA.id, nombre: ANA.nombre, papel: 'inquilino' }],
    });
    render(<ReservaFicha reserva={sinDueno} hoy="2026-10-12" personas={[DUENA, ANA]} />);
    await userEvent.click(screen.getByRole('button', { name: 'No se presentó a firmar' }));
    const modal = await screen.findByRole('dialog');
    const cerrar = within(modal).getByRole('button', { name: 'Cerrar la reserva' });
    expect(cerrar).toBeDisabled();
    await userEvent.selectOptions(within(modal).getByLabelText(/Propietario/), DUENA.id);
    await userEvent.click(cerrar);
    await waitFor(() =>
      expect(cambiarEstadoReserva).toHaveBeenCalledWith('token', RID, {
        estado: 'no_se_presento',
        propietarioId: DUENA.id,
      }),
    );
  });

  it('regla 171: cerrada con retención, lo dice', () => {
    render(
      <ReservaFicha
        reserva={reserva({ estado: 'no_se_presento', senaRetenida: 500 })}
        hoy="2026-10-20"
      />,
    );
    expect(screen.getByText(/se le entrega al propietario en su próxima/)).toHaveTextContent(
      'U$S 500,00',
    );
  });
});

describe('La seña como depósito, al convertir (regla 170)', () => {
  const sena = reserva().sena!;

  it.each([
    [500, 'USD', 'La seña de U$S 500,00 pasa a ser el depósito: ya está cobrado.'],
    [600, 'USD', 'Faltan U$S 100,00: se proponen como cargo de ingreso al activar el contrato.'],
    [400, 'USD', 'Sobran U$S 100,00: al guardar, se le reintegran al inquilino'],
    [500_000, 'ARS', 'tienen que ser de la misma moneda'],
  ] as const)('depósito de %s %s', (deposito, moneda, texto) => {
    render(<SenaComoDeposito sena={sena} deposito={deposito} moneda={moneda} />);
    expect(screen.getByRole('status')).toHaveTextContent(texto);
  });
});

describe('El anexo de inventario (regla 174)', () => {
  it('sin plantilla de anexo, se descarga con el modelo de la plataforma', async () => {
    const blob = new Blob(['PK']);
    generarAnexoInventario.mockResolvedValueOnce({ blob, nombre: 'Anexo-inventario-ALT-1.docx' });
    render(
      <GenerarContrato
        contrato={{ id: 'k1', tipo: 'vivienda', estado: 'vigente' } as never}
        plantillas={[]}
      />,
    );
    expect(screen.getByLabelText('Plantilla del anexo de inventario')).toHaveValue('__modelo__');
    await userEvent.click(
      screen.getByRole('button', { name: '⬇️ Descargar el anexo de inventario (Word)' }),
    );
    await waitFor(() =>
      expect(descargarArchivo).toHaveBeenCalledWith(blob, 'Anexo-inventario-ALT-1.docx'),
    );
    expect(generarAnexoInventario).toHaveBeenCalledWith('token', 'k1', null);
  });

  it('con una plantilla de anexo, la propone primero; las de contrato no se mezclan', () => {
    const plantilla = (id: string, documento: 'contrato' | 'inventario', nombre: string) => ({
      id,
      nombre,
      tipoContrato: null,
      documento,
      formato: 'word' as const,
      nombreArchivo: `${nombre}.docx`,
      tamano: 1,
      actualizada: '2026-10-15T12:00:00Z',
    });
    render(
      <GenerarContrato
        contrato={{ id: 'k1', tipo: 'vivienda', estado: 'vigente' } as never}
        plantillas={[
          plantilla('11111111-1111-4111-8111-111111111111', 'contrato', 'Locación'),
          plantilla('22222222-2222-4222-8222-222222222222', 'inventario', 'Anexo Vacker'),
        ]}
      />,
    );
    const anexo = screen.getByLabelText('Plantilla del anexo de inventario');
    expect(anexo).toHaveValue('22222222-2222-4222-8222-222222222222');
    expect(within(anexo).queryByText('Locación')).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Plantilla')).queryByText('Anexo Vacker'),
    ).not.toBeInTheDocument();
  });
});
