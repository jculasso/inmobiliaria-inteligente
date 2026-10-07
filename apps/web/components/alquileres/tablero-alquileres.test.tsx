import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type {
  CierreTablero,
  FilaTablero,
  Indicador,
  TableroAlquileresDto,
  TablerosAlquileresDto,
} from '@vacker/types';
import { TableroAlquileres } from './tablero-alquileres';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/alquileres',
}));
const { getDetalle } = vi.hoisted(() => ({ getDetalle: vi.fn() }));
vi.mock('../../lib/alquileres-api', () => ({ getDetalleTableroAlquileres: getDetalle }));
vi.mock('../../lib/supabase/client', () => ({ getAccessToken: vi.fn().mockResolvedValue('t') }));

const fila = (n: number, importe: number | null, over: Partial<FilaTablero> = {}): FilaTablero => ({
  id: `f${n}`,
  href: `/alquileres/contratos/c${n}`,
  contrato: String(n),
  persona: `Persona ${n}`,
  detalle: 'Calle',
  fecha: '2026-10-05',
  importe,
  propiedad: `Calle ${n}`,
  inquilino: `Inquilino ${n}`,
  propietario: `Dueño ${n}`,
  moneda: 'ARS',
  alquiler: null,
  indexa: null,
  vence: null,
  dias: null,
  estado: null,
  ...over,
});
const ind = (filas: FilaTablero[], porImporte = false): Indicador => ({
  valor: porImporte ? filas.reduce((s, f) => s + (f.importe ?? 0), 0) : filas.length,
  filas,
});
const vacio = ind([]);

const HOY = '2026-10-20';
const ULTIMO = [31, 28, 31, 30, 31, 30, 31, 31, 30];
/** La foto de cada mes: en marzo, siete vigentes y deuda; el mes en curso y los que vienen, hoy. */
const cierres: CierreTablero[] = Array.from({ length: 12 }, (_, i) => {
  const mes = `2026-${String(i + 1).padStart(2, '0')}`;
  const marzo = i === 2;
  return {
    mes,
    cierre: i < 9 ? `${mes}-${ULTIMO[i]}` : HOY,
    vigentes: marzo ? 7 : 2,
    vivienda: marzo ? 5 : 2,
    comercial: marzo ? 2 : 0,
    alquilerMensual: [{ moneda: 'ARS', valor: marzo ? 3_000_000 : 1_537_518, contratos: 2 }],
    mora: marzo
      ? [
          {
            moneda: 'ARS',
            valor: 90_000,
            conceptos: 3,
            inquilinos: 2,
            tramos: [
              { tramo: '1-30', valor: 60_000, conceptos: 2 },
              { tramo: '31-60', valor: 30_000, conceptos: 1 },
              { tramo: '61-90', valor: 0, conceptos: 0 },
              { tramo: '90+', valor: 0, conceptos: 0 },
            ],
          },
        ]
      : [],
  };
});

const evolucionMes = (mes: string, emitido: number, cobrado: number, cobradoHoy: number) => ({
  mes,
  moneda: 'ARS' as const,
  emitido,
  cobrado,
  emitidos: 2,
  cobrados: 1,
  cobradoHoy,
});

const tablero = (over: Partial<TableroAlquileresDto> = {}): TableroAlquileresDto => ({
  hoy: HOY,
  mes: '2026-10',
  anio: 2026,
  tipo: 'todos',
  nuevos: {
    porMes: Array.from({ length: 12 }, (_, i) => (i === 2 ? ind([fila(9, 500_000)]) : vacio)),
    importePorMes: Array.from({ length: 12 }, (_, i) => (i === 2 ? 500_000 : 0)),
    anterior: Array.from({ length: 12 }, (_, i) => (i === 2 || i === 4 ? 1 : 0)),
  },
  cartera: {
    porTipo: [
      { tipo: 'vivienda', cantidad: 2, importe: 1_537_518, pct: 100 },
      { tipo: 'comercial', cantidad: 0, importe: 0, pct: 0 },
    ],
    vigentes: ind([fila(5, 1_137_518), fila(6, 400_000)]),
    vivienda: 2,
    comercial: 0,
    alquilerMensual: [
      { moneda: 'ARS', indicador: ind([fila(5, 1_137_518), fila(6, 400_000)], true) },
    ],
  },
  cobranza: [],
  morosidad: [],
  evolucion: [
    evolucionMes('2026-01', 1_000_000, 900_000, 1_000_000),
    evolucionMes('2026-02', 1_000_000, 700_000, 1_000_000),
    evolucionMes('2026-10', 1_537_518, 1_000_000, 1_287_518),
  ],
  cierres,
  ingresos: [],
  tareas: {
    indexacionesVencidas: ind([fila(5, null)]),
    indexacionesProximas: vacio,
    vencen: [
      { dias: 30, indicador: vacio },
      { dias: 60, indicador: vacio },
      { dias: 90, indicador: vacio },
    ],
    depositos: vacio,
    liquidaciones: vacio,
    deudores: vacio,
    sinFirmar: vacio,
    escalones: vacio,
    reclamos: vacio,
    polizas: vacio,
    boletas: vacio,
  },
  ...over,
});

/** Los tres cortes: el comercial, sin contratos, para notar el cambio. */
const tres = (t: TableroAlquileresDto): TablerosAlquileresDto => ({
  todos: t,
  vivienda: { ...t, tipo: 'vivienda' },
  comercial: {
    ...t,
    tipo: 'comercial',
    cartera: { ...t.cartera, vigentes: ind([]), vivienda: 0, comercial: 0 },
  },
});

const grupo = (nombre: string) => within(screen.getByRole('group', { name: nombre }));
const tarjeta = (nombre: RegExp) => screen.getByRole('button', { name: nombre });

beforeEach(() => {
  push.mockClear();
  getDetalle.mockReset();
});

describe('TableroAlquileres', () => {
  // Regla 26 y 79: el detalle de un importe del período se pide al abrirlo y cierra en el número.
  it('una tarjeta del período pide su lista, y el total de la lista es el número', async () => {
    getDetalle.mockResolvedValue(ind([fila(5, 1_137_518), fila(6, 150_000)], true));
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.click(tarjeta(/^Importe cobrado: \$ 1\.287\.518/));
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Cargando');
    const dialogo = within(screen.getByRole('dialog'));
    expect((await dialogo.findByText('Total')).parentElement).toHaveTextContent('$ 1.287.518');
    expect(dialogo.getAllByRole('link')[0]).toHaveAttribute('href', '/alquileres/contratos/c5');
    expect(getDetalle).toHaveBeenCalledWith('t', {
      indicador: 'importeCobrado',
      desde: '2026-10',
      hasta: '2026-10',
      moneda: 'ARS',
      tipo: 'todos',
    });
  });

  it('si la lista no llega, lo dice', async () => {
    getDetalle.mockRejectedValue(new Error('caída'));
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.click(tarjeta(/^Alquileres emitidos: /));
    expect(
      await within(screen.getByRole('dialog')).findByText(/No se pudo cargar la lista/),
    ).toBeInTheDocument();
  });

  // Reglas 28 y 76: lo cobrado hasta hoy y lo que entró dentro del mes, sobre lo emitido.
  it('la cobranza dice el porcentaje de lo emitido y lo cobrado dentro del mes', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(screen.getByText('50% de los emitidos')).toBeInTheDocument();
    expect(screen.getByText('84% de lo emitido · 65% se cobró dentro del mes')).toBeInTheDocument();
  });

  it('sin deuda vencida lo dice, en vez de tarjetas en cero', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(screen.getByText('Ningún inquilino tiene deuda vencida.')).toBeInTheDocument();
  });

  // Regla 31: lo que está en cero no se abre.
  it('lo que hay que hacer: con algo se abre, en cero no', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(screen.getByRole('button', { name: /Indexaciones vencidas/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Depósitos a devolver/ })).toBeDisabled();
  });

  it('el gráfico es del año elegido: doce meses y la planilla con los ingresos del año anterior', () => {
    render(
      <TableroAlquileres
        tableros={tres(
          tablero({
            ingresos: [
              {
                mes: '2026-10',
                moneda: 'ARS',
                honorarios: 70_000,
                gastos: 5_000,
                punitorios: 0,
                comisiones: 0,
              },
              {
                mes: '2025-10',
                moneda: 'ARS',
                honorarios: 50_000,
                gastos: 0,
                punitorios: 0,
                comisiones: 0,
              },
            ],
          }),
        )}
      />,
    );
    const planilla = screen.getByRole('table', { name: /alquileres e ingresos por mes de 2026/i });
    expect(
      within(planilla)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(expect.arrayContaining(['Ene', 'Dic']));
    expect(within(planilla).getByText('Ingresos 2025')).toBeTruthy();
    // El pie es del período elegido; sin comparar con el año anterior (regla 81).
    expect(
      screen.getByText(
        /cobrado al cierre de cada mes 65% de lo emitido · ingresos \$\s?75\.000,00$/,
      ),
    ).toBeTruthy();
  });

  it('cambiar el año va a la misma página con ?anio=, y conserva el período', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2025' } });
    expect(push).toHaveBeenCalledWith('/alquileres?anio=2025&periodo=mes&mes=10', {
      scroll: false,
    });
  });

  it('un año sin alquileres generados lo dice, en vez de un gráfico en cero', () => {
    render(<TableroAlquileres tableros={tres(tablero({ evolucion: [], ingresos: [] }))} />);
    expect(screen.getByText('Todavía no hay alquileres generados en 2026.')).toBeTruthy();
  });

  // Punto 8 de Javier y regla 75: contratos nuevos del período, con el mismo período del año anterior.
  it('contratos nuevos siguen al período de la pantalla', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(tarjeta(/^Nuevos en octubre 2026: 0/)).toHaveTextContent('0 en 2025');
    // Ya no tiene tarjetas Q1 a Q4 propias.
    expect(screen.queryByRole('button', { name: /^Q1: / })).toBeNull();
    fireEvent.click(grupo('Período').getByRole('button', { name: 'Trimestre' }));
    fireEvent.click(grupo('Trimestre').getByRole('button', { name: 'Q1' }));
    expect(tarjeta(/^Nuevos en Q1 2026: 1/)).toHaveTextContent('1 en 2025');
    fireEvent.click(grupo('Período').getByRole('button', { name: 'Año' }));
    const nuevos = tarjeta(/^Nuevos en 2026: 1/);
    expect(nuevos).toHaveTextContent('2 en 2025');
    fireEvent.click(nuevos);
    const fila9 = within(within(screen.getByRole('dialog')).getByRole('table'))
      .getByText('9')
      .closest('tr')!;
    expect(fila9).toHaveTextContent('Calle 9');
    expect(fila9).toHaveTextContent('$ 500.000,00');
  });

  // Javier, 6/10/2026: «como tiene una demora, parece que no está funcionando».
  it('el filtro Todos / Particulares / Comerciales cambia al instante, sin pedirle nada al servidor', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(tarjeta(/^Contratos vigentes: 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comerciales' }));
    expect(screen.getByRole('button', { name: 'Comerciales' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(tarjeta(/^Contratos vigentes: 0/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(null, '', '/alquileres?tipo=comercial');
  });

  it('con todos, el reparto por tipo: cuántos contratos, cuánto por mes y qué parte; tocarlo filtra', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    const particulares = screen.getByTitle('Ver solo particulares');
    expect(particulares).toHaveTextContent('2 de 2 contratos');
    expect(particulares).toHaveTextContent('$ 1.537.518,00 por mes · 100%');
    fireEvent.click(particulares);
    expect(screen.getByRole('button', { name: 'Particulares' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  // Javier, 6/10/2026: «Propietario, Inquilino, Importe Alquiler vigente, cuando indexa, cuando vence».
  it('contratos vigentes: cada uno con sus partes, alquiler de hoy, próxima indexación y vencimiento', () => {
    const vigentes = ind([
      fila(5, null, { alquiler: 1_137_518, indexa: '2026-12-15', vence: '2027-08-14' }),
      fila(6, null, { alquiler: 1_500, moneda: 'USD', indexa: '2026-10-01', vence: '2028-01-31' }),
    ]);
    render(
      <TableroAlquileres
        tableros={tres(tablero({ cartera: { ...tablero().cartera, vigentes } }))}
      />,
    );
    fireEvent.click(tarjeta(/^Contratos vigentes: /));
    const tabla = within(screen.getByRole('dialog')).getByRole('table');
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual([
      'Contrato',
      'Propiedad',
      'Inquilino',
      'Propietario',
      'Alquiler hoy',
      'Próx. indexación',
      'Vence',
    ]);
    const [, c5, c6] = within(tabla).getAllByRole('row');
    expect(c5).toHaveTextContent('Inquilino 5Dueño 5$ 1.137.518,0015/12/202614/08/2027');
    // En dólares, con su moneda; una indexación que ya pasó, marcada.
    expect(c6).toHaveTextContent('U$S 1.500,00');
    expect(c6).toHaveTextContent('01/10/2026 vencida');
    // Lo de hoy viaja con el tablero: no se pide nada.
    expect(getDetalle).not.toHaveBeenCalled();
  });

  it('una tarea lleva a donde se resuelve', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.click(screen.getByRole('button', { name: /Indexaciones vencidas/ }));
    expect(
      within(screen.getByRole('dialog')).getByRole('link', { name: 'Ir a indexar →' }),
    ).toHaveAttribute('href', '/alquileres/indexaciones');
  });

  // Prueba en producción, 6/10/2026: «Total $ 5,00» (la cantidad de filas) y un
  // contrato en dólares sumado a los pesos.
  it('propietarios para liquidar: el total suma los importes, pesos y dólares por separado', () => {
    const liquidaciones = ind([
      fila(1, 1_000_000),
      fila(2, 928_307.62),
      fila(8, 1_409.25, { moneda: 'USD' }),
    ]);
    render(
      <TableroAlquileres
        tableros={tres(tablero({ tareas: { ...tablero().tareas, liquidaciones } }))}
      />,
    );
    const tarea = screen.getByRole('button', { name: /Propietarios para liquidar/ });
    expect(tarea).toHaveTextContent('$ 1.928.307,62 · U$S 1.409,25');
    fireEvent.click(tarea);
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText('Total').parentElement).toHaveTextContent(
      '$ 1.928.307,62 · U$S 1.409,25',
    );
  });

  it('inquilinos con deuda: el total es la deuda, no la cantidad de inquilinos', () => {
    const deudores = ind([fila(3, 250_000)]);
    render(
      <TableroAlquileres tableros={tres(tablero({ tareas: { ...tablero().tareas, deudores } }))} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Inquilinos con deuda/ }));
    const total = within(screen.getByRole('dialog')).getByText('Total').parentElement!;
    expect(total).toHaveTextContent('$ 250.000,00');
    expect(total).not.toHaveTextContent('U$S');
  });

  // Reglas 74 a 82: el período de toda la pantalla (Javier, 7/10/2026).
  describe('el período', () => {
    it('regla 74: al entrar, el mes en curso; cambiarlo es instantáneo y queda en la dirección', () => {
      const replace = vi.spyOn(window.history, 'replaceState');
      render(<TableroAlquileres tableros={tres(tablero())} />);
      expect(grupo('Período').getByRole('button', { name: 'Mes' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByLabelText('Mes')).toHaveValue('10');
      fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '3' } });
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres?periodo=mes&mes=3');
      fireEvent.click(grupo('Período').getByRole('button', { name: 'Trimestre' }));
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres?periodo=trimestre&q=1');
      fireEvent.click(grupo('Trimestre').getByRole('button', { name: 'Q3' }));
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres?periodo=trimestre&q=3');
      fireEvent.click(grupo('Período').getByRole('button', { name: 'Año' }));
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres?periodo=anio');
      expect(push).not.toHaveBeenCalled();
    });

    it('regla 74: el período de la dirección es el que se ve al entrar', () => {
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      expect(grupo('Trimestre').getByRole('button', { name: 'Q1' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('heading', { name: /Cobranza de Q1 2026/ })).toBeInTheDocument();
    });

    it('regla 75: los flujos del trimestre y del año son la suma de sus meses', () => {
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      expect(tarjeta(/^Alquileres emitidos: 4/)).toBeInTheDocument();
      expect(tarjeta(/^Importe emitido: \$ 2\.000\.000/)).toBeInTheDocument();
      // Regla 76: 1.600.000 de 2.000.000 dentro del mes, sobre los totales.
      expect(tarjeta(/^Importe cobrado: /)).toHaveTextContent('80% se cobró dentro del mes');
      fireEvent.click(grupo('Período').getByRole('button', { name: 'Año' }));
      expect(tarjeta(/^Alquileres emitidos: 6/)).toBeInTheDocument();
    });

    it('regla 77: un período que ya cerró muestra la cartera y la deuda a su cierre, y lo dice', async () => {
      getDetalle.mockResolvedValue(ind([fila(1, null)]));
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      expect(screen.getByRole('heading', { name: /Cartera · al 31\/03\/2026/ })).toBeTruthy();
      expect(tarjeta(/^Contratos vigentes: 7/)).toHaveTextContent('5 particulares · 2 comerciales');
      expect(tarjeta(/^Alquiler mensual: \$ 3\.000\.000/)).toBeInTheDocument();
      expect(tarjeta(/^Deuda vencida: \$ 90\.000/)).toHaveTextContent('3 conceptos · 2 inquilinos');
      expect(tarjeta(/^31 a 60 días: \$ 30\.000/)).toBeInTheDocument();
      // Su lista se pide al abrirla, al cierre del período.
      fireEvent.click(tarjeta(/^31 a 60 días: /));
      await within(screen.getByRole('dialog')).findByRole('table');
      expect(getDetalle).toHaveBeenCalledWith('t', {
        indicador: 'mora',
        desde: '2026-01',
        hasta: '2026-03',
        moneda: 'ARS',
        tramo: '31-60',
        tipo: 'todos',
      });
    });

    it('regla 77: el período que llega a hoy es a hoy', () => {
      render(<TableroAlquileres tableros={tres(tablero())} periodoInicial={{ por: 'anio' }} />);
      expect(screen.getByRole('heading', { name: /Cartera · a hoy/ })).toBeTruthy();
      expect(tarjeta(/^Contratos vigentes: 2/)).toBeInTheDocument();
    });

    it('regla 78: lo que hay que hacer y los vencimientos son siempre a hoy', () => {
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      expect(screen.getByRole('heading', { name: /Lo que hay que hacer · a hoy/ })).toBeTruthy();
      expect(tarjeta(/^Vencen en 90 días: /)).toHaveTextContent('contratos para renovar, a hoy');
    });

    it('regla 79: los ingresos del período, el total y cada parte, piden su lista', async () => {
      getDetalle.mockResolvedValue(ind([fila(1, 70_000)], true));
      const ingresos = [
        { mes: '2026-01', honorarios: 70_000, gastos: 5_000 },
        { mes: '2026-02', honorarios: 30_000, gastos: 0 },
        { mes: '2026-10', honorarios: 1, gastos: 1 },
      ].map((i) => ({ ...i, moneda: 'ARS' as const, punitorios: 0, comisiones: 0 }));
      render(
        <TableroAlquileres
          tableros={tres(tablero({ ingresos }))}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      expect(tarjeta(/^Ingresos: \$ 105\.000/)).toBeInTheDocument();
      expect(tarjeta(/^Ingresos de Q1 2026: \$ 105\.000/)).toBeInTheDocument();
      fireEvent.click(tarjeta(/^Honorarios: \$ 100\.000/));
      await within(screen.getByRole('dialog')).findByRole('table');
      expect(getDetalle).toHaveBeenCalledWith(
        't',
        expect.objectContaining({ indicador: 'honorarios', desde: '2026-01', hasta: '2026-03' }),
      );
      // Una parte en cero no tiene lista para abrir.
      expect(screen.queryByRole('button', { name: /^Punitorios: / })).toBeNull();
    });

    it('regla 80: con el trimestre, el gráfico y la planilla son de cuatro trimestres; tocar uno lo elige', () => {
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      const planilla = screen.getByRole('table', {
        name: /alquileres e ingresos por trimestre de 2026/i,
      });
      const encabezados = within(planilla).getAllByRole('columnheader');
      expect(encabezados.map((th) => th.textContent)).toEqual([
        'Métrica',
        'Q1',
        'Q2',
        'Q3',
        'Q4',
        'Total',
      ]);
      expect(encabezados[1]).toHaveAttribute('aria-current', 'true');
      fireEvent.click(within(encabezados[4]!).getByRole('button', { name: 'Q4' }));
      expect(grupo('Trimestre').getByRole('button', { name: 'Q4' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('regla 80: con el año, doce meses sin uno marcado; tocar un mes lo elige', () => {
      render(<TableroAlquileres tableros={tres(tablero())} periodoInicial={{ por: 'anio' }} />);
      const planilla = screen.getByRole('table', {
        name: /alquileres e ingresos por mes de 2026/i,
      });
      const encabezados = within(planilla).getAllByRole('columnheader');
      expect(encabezados.filter((th) => th.getAttribute('aria-current'))).toEqual([]);
      fireEvent.click(within(encabezados[2]!).getByRole('button', { name: 'Feb' }));
      expect(screen.getByLabelText('Mes')).toHaveValue('2');
    });
  });
});
