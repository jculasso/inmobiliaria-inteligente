import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  compactarTableros,
  type CicloDelMes,
  type CierreTablero,
  type FilaTablero,
  type Indicador,
  type TableroAlquileresDto,
  type TablerosAlquileresDto,
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
const CICLO: CicloDelMes = {
  mes: '2026-10',
  vencimiento: { dia: 5, fecha: '2026-10-05', motivo: null },
  pagoPropietarios: { dia: 10, fecha: '2026-10-13', motivo: 'el 10 fue sábado y el 12 feriado' },
  generarSiguiente: { dia: 25, fecha: '2026-10-26', motivo: 'el 25 es domingo', mes: '2026-11' },
};
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
    mora: [],
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

/** La deuda de hoy: una de 15 días y otra de 76. */
const deuda15 = fila(7, 250_000, { dias: 15, href: '/alquileres/personas/p7' });
const deuda76 = fila(8, 100_000, { dias: 76, href: '/alquileres/personas/p8' });

const tablero = (over: Partial<TableroAlquileresDto> = {}): TableroAlquileresDto => ({
  hoy: HOY,
  mes: '2026-10',
  anio: 2026,
  tipo: 'todos',
  ciclo: CICLO,
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
    vigentes: ind([fila(5, null), fila(6, null)]),
    vivienda: 2,
    comercial: 0,
    alquilerMensual: [
      { moneda: 'ARS', indicador: ind([fila(5, 1_137_518), fila(6, 400_000)], true) },
    ],
  },
  cobranza: [
    {
      moneda: 'ARS',
      emitidos: ind([
        fila(5, 1_137_518, { estado: 'Cobrado' }),
        fila(6, 400_000, { estado: 'Pagó $ 150.000,00, falta $ 250.000,00' }),
      ]),
      cobrados: ind([fila(5, 1_137_518)]),
      importeEmitido: ind([fila(5, 1_137_518), fila(6, 400_000)], true),
      importeCobrado: ind([fila(5, 1_137_518), fila(6, 150_000)], true),
    },
  ],
  morosidad: [
    {
      moneda: 'ARS',
      total: ind([deuda15, deuda76], true),
      tramos: [
        { tramo: '1-30', indicador: ind([deuda15], true) },
        { tramo: '31-60', indicador: vacio },
        { tramo: '61-90', indicador: ind([deuda76], true) },
        { tramo: '90+', indicador: vacio },
      ],
    },
  ],
  evolucion: [
    evolucionMes('2026-01', 1_000_000, 900_000, 1_000_000),
    evolucionMes('2026-02', 1_000_000, 700_000, 1_000_000),
    evolucionMes('2026-10', 1_537_518, 1_000_000, 1_287_518),
  ],
  cierres,
  ingresos: [
    { mes: '2026-01', moneda: 'ARS', honorarios: 30_000, gastos: 0, punitorios: 0, comisiones: 0 },
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
  tareas: {
    indexacionesVencidas: ind([fila(5, null)]),
    indexacionesProximas: vacio,
    vencen: [
      { dias: 30, indicador: vacio },
      { dias: 60, indicador: vacio },
      { dias: 90, indicador: vacio },
    ],
    depositos: vacio,
    liquidaciones: ind([fila(1, 1_000_000), fila(2, 928_307.62)]),
    deudores: ind([deuda76]),
    sinFirmar: vacio,
    escalones: vacio,
    reclamos: vacio,
    polizas: vacio,
    boletas: vacio,
    indexacionesEsperan: vacio,
    finalesPendientes: vacio,
    reservasPorVencer: vacio,
    reservasAprobadas: vacio,
    generarMes: vacio,
    generarSiguiente: null,
  },
  ...over,
});

/** Los tres cortes: el comercial, sin contratos ni ingresos, para notar el cambio. */
const tres = (t: TableroAlquileresDto): TablerosAlquileresDto => ({
  todos: t,
  vivienda: { ...t, tipo: 'vivienda' },
  comercial: {
    ...t,
    tipo: 'comercial',
    cartera: { ...t.cartera, vigentes: ind([]), vivienda: 0, comercial: 0 },
    cobranza: [],
    morosidad: [],
    ingresos: [],
    evolucion: [],
    tareas: { ...t.tareas, liquidaciones: vacio, indexacionesVencidas: vacio },
  },
});

const grupo = (nombre: string) => within(screen.getByRole('group', { name: nombre }));
const tarjeta = (nombre: RegExp) => screen.getByRole('button', { name: nombre });
const bloque = (nombre: string) => within(screen.getByRole('region', { name: nombre }));
const tareas = (t: TableroAlquileresDto = tablero()) =>
  render(<TableroAlquileres tableros={tres(t)} />);

beforeEach(() => {
  push.mockClear();
  getDetalle.mockReset();
});

describe('TableroAlquileres en tres bloques (17/10/2026)', () => {
  it('regla 176: tres bloques, en orden —Hoy, Lo que hay que hacer, Cómo vamos—, y el encabezado sin filtros', () => {
    tareas();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Hoy',
      'Lo que hay que hacer',
      'Cómo vamos',
    ]);
    const encabezado = screen.getByRole('heading', { level: 2, name: 'Dashboard' }).parentElement!
      .parentElement!;
    expect(within(encabezado).queryByRole('group')).toBeNull();
    expect(within(encabezado).queryByRole('combobox')).toBeNull();
    // Los filtros están en «Cómo vamos».
    expect(bloque('Cómo vamos').getByRole('group', { name: 'Período' })).toBeInTheDocument();
    expect(bloque('Cómo vamos').getByRole('group', { name: 'Tipo de contrato' })).toBeTruthy();
    expect(bloque('Cómo vamos').getByRole('combobox', { name: 'Año' })).toBeTruthy();
  });

  describe('Hoy', () => {
    it('regla 177: pasado el vencimiento, lo que falta cobrar está atrasado, en rojo', () => {
      tareas();
      const cobranza = tarjeta(/^Cobranza de octubre: 84%/);
      expect(cobranza).toHaveTextContent('$ 1,3 M de $ 1,5 M');
      expect(cobranza).toHaveTextContent('1 de 2 pagaron · 1 atrasado');
      expect(within(cobranza).getByText('1 atrasado')).toHaveClass('text-danger');
    });

    it('regla 177: antes del vencimiento, lo que falta va en gris y se nombra «por vencer»', () => {
      tareas(tablero({ hoy: '2026-10-03' }));
      const falta = within(tarjeta(/^Cobranza de octubre: /)).getByText('1 por vencer');
      expect(falta).not.toHaveClass('text-danger');
      expect(falta).toHaveClass('text-muted');
    });

    it('regla 177: la cobranza abre los alquileres emitidos del mes, con su estado, y la lista suma lo emitido', () => {
      tareas();
      fireEvent.click(tarjeta(/^Cobranza de octubre: /));
      const dialogo = within(
        screen.getByRole('dialog', { name: 'Alquileres emitidos de octubre' }),
      );
      expect(dialogo.getByRole('table')).toHaveTextContent('Pagó $ 150.000,00, falta $ 250.000,00');
      expect(dialogo.getByText('Total').parentElement).toHaveTextContent('$ 1.537.518,00');
      expect(getDetalle).not.toHaveBeenCalled();
    });

    it('regla 177: «Hoy» no lo cambian el tipo, el período ni el año', () => {
      tareas();
      const antes = screen.getByRole('region', { name: 'Hoy' }).textContent;
      fireEvent.click(screen.getByRole('button', { name: 'Comerciales' }));
      fireEvent.click(grupo('Período').getByRole('button', { name: 'Trimestre' }));
      expect(screen.getByRole('region', { name: 'Hoy' }).textContent).toBe(antes);
      // «Cómo vamos» sí cambió: el corte comercial no tiene vigentes.
      expect(tarjeta(/^Cartera: 0/)).toBeInTheDocument();
      // Y lo que hay que hacer sigue siendo de toda la cartera.
      expect(screen.getByRole('button', { name: /Indexaciones vencidas/ })).toBeInTheDocument();
    });

    it('regla 177: la deuda vencida abre su lista, que suma el número; cada tramo de la leyenda abre el suyo', () => {
      tareas();
      const deuda = tarjeta(/^Deuda vencida: \$ 350\.000/);
      expect(deuda).toHaveTextContent('2 inquilinos · 1 con más de 30 días');
      fireEvent.click(deuda);
      expect(within(screen.getByRole('dialog')).getByText('Total').parentElement).toHaveTextContent(
        '$ 350.000,00',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      // Solo los tramos que no están en cero; cada uno, un botón aparte de la tarjeta.
      const leyenda = within(screen.getByRole('list', { name: 'Deuda vencida por antigüedad' }));
      expect(leyenda.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Hasta 30 d $ 250.000',
        '61 a 90 d $ 100.000',
      ]);
      fireEvent.click(leyenda.getByRole('button', { name: /61 a 90 d/ }));
      const tramo = within(
        screen.getByRole('dialog', { name: 'Deuda vencida · 61 a 90 días, a hoy' }),
      );
      expect(tramo.getByText('Total').parentElement).toHaveTextContent('$ 100.000,00');
      // Reemplaza la tarea «Inquilinos con deuda de más de 30 días».
      expect(screen.queryByRole('button', { name: /Inquilinos con deuda/ })).toBeNull();
    });

    it('regla 177: a liquidar a propietarios: el neto de la lista, con «Ir a liquidar» y la fecha de pago', () => {
      tareas();
      const liquidar = tarjeta(/^A liquidar a propietarios: \$ 1,9 M/);
      expect(liquidar).toHaveTextContent('2 propietarios con cobros sin liquidar');
      expect(liquidar).toHaveTextContent('Se pagó el mar 13');
      fireEvent.click(liquidar);
      const dialogo = within(screen.getByRole('dialog'));
      expect(dialogo.getByText('Total').parentElement).toHaveTextContent('$ 1.928.307,62');
      expect(dialogo.getByRole('link', { name: 'Ir a liquidar →' })).toHaveAttribute(
        'href',
        '/alquileres/liquidaciones/nueva',
      );
      // Ya no es una tarea.
      expect(screen.queryByRole('button', { name: /Propietarios para liquidar/ })).toBeNull();
    });

    it('regla 177: los ingresos del mes, con las partes que no están en cero; la lista se pide al abrirla, del mes y de toda la cartera', async () => {
      getDetalle.mockResolvedValue(ind([fila(1, 75_000)], true));
      tareas();
      // El filtro de «Cómo vamos» no la cambia.
      fireEvent.click(screen.getByRole('button', { name: 'Particulares' }));
      const ingresos = tarjeta(/^Ingresos de octubre: \$ 75\.000/);
      expect(ingresos).toHaveTextContent('Honorarios$ 70.000');
      expect(ingresos).toHaveTextContent('Gastos adm.$ 5.000');
      expect(ingresos).not.toHaveTextContent('Punitorios');
      fireEvent.click(ingresos);
      await within(screen.getByRole('dialog')).findByRole('table');
      expect(getDetalle).toHaveBeenCalledWith('t', {
        indicador: 'ingresos',
        desde: '2026-10',
        hasta: '2026-10',
        moneda: 'ARS',
        tipo: 'todos',
      });
    });

    it('regla 177: con alquileres en dólares, cada tarjeta suma una línea, sin duplicar los bloques', () => {
      const base = tablero();
      const usd = (n: number, importe: number) => fila(n, importe, { moneda: 'USD' });
      tareas(
        tablero({
          cobranza: [
            ...base.cobranza,
            {
              moneda: 'USD',
              emitidos: ind([usd(30, 1_500)]),
              cobrados: ind([]),
              importeEmitido: ind([usd(30, 1_500)], true),
              importeCobrado: ind([], true),
            },
          ],
          morosidad: [
            ...base.morosidad,
            {
              moneda: 'USD',
              total: ind([usd(31, 500)], true),
              tramos: [{ tramo: '1-30', indicador: ind([usd(31, 500)], true) }],
            },
          ],
        }),
      );
      expect(tarjeta(/^Cobranza de octubre: /)).toHaveTextContent('U$S 0 de U$S 1.500');
      expect(tarjeta(/^Deuda vencida: /)).toHaveTextContent('U$S 500 en dólares');
      expect(screen.getAllByRole('button', { name: /^Cobranza de / })).toHaveLength(1);
      // La lista trae las dos monedas, cada una con su total.
      fireEvent.click(tarjeta(/^Deuda vencida: /));
      expect(within(screen.getByRole('dialog')).getByText('Total').parentElement).toHaveTextContent(
        '$ 350.000,00 · U$S 500,00',
      );
    });

    it('regla 178: la línea del mes: vencimiento, pago a propietarios con su motivo, hoy y el aviso de generar', () => {
      tareas();
      const linea = screen.getByRole('img', { name: /^Octubre: los alquileres vencieron/ });
      expect(linea).toHaveAccessibleName(
        'Octubre: los alquileres vencieron el lunes 5; a los propietarios se les pagó el martes 13, porque el 10 fue sábado y el 12 feriado; hoy es martes 20; noviembre se genera desde el lunes 26, porque el 25 es domingo.',
      );
      expect(linea).toHaveTextContent('lun 5 · Vencieron los alquileres');
      expect(linea).toHaveTextContent(
        'mar 13 · Pago a propietarios (el 10 fue sábado y el 12 feriado)',
      );
      expect(linea).toHaveTextContent('lun 26 · Generar noviembre');
      expect(linea).toHaveTextContent('Hoy');
    });

    it('regla 178: con una API anterior, sin la línea, «Hoy» se ve igual y sin ella', () => {
      tareas(tablero({ ciclo: null }));
      expect(screen.queryByRole('img', { name: /^Octubre:/ })).toBeNull();
      expect(tarjeta(/^Cobranza de octubre: /)).toBeInTheDocument();
    });
  });

  describe('Lo que hay que hacer', () => {
    const conTodo = () => {
      const base = tablero();
      return tablero({
        tareas: {
          ...base.tareas,
          generarMes: ind([fila(40, null, { estado: 'Sin generar' })]),
          generarSiguiente: ind([fila(41, null, { estado: 'Sin generar' })]),
          boletas: ind([
            fila(10, 412_300, { fecha: '2026-10-19' }),
            fila(11, 1_000_000.4, { fecha: HOY }),
            fila(12, 204_500, { fecha: '2026-10-21' }),
          ]),
          vencen: [
            {
              dias: 30,
              indicador: ind([
                fila(13, null, { fecha: null, vence: '2026-10-19' }),
                fila(14, null, { fecha: null, vence: HOY }),
                fila(15, null, { fecha: null, vence: '2026-11-10' }),
              ]),
            },
            { dias: 60, indicador: ind([fila(16, null, { vence: '2026-12-01' })]) },
            { dias: 90, indicador: ind([fila(17, null, { vence: '2027-01-10' })]) },
          ],
          finalesPendientes: ind([fila(18, 57_269.17)]),
          reclamos: ind([fila(19, null)]),
        },
      });
    };
    const renglones = (nombre: string) =>
      within(screen.getByText(nombre, { selector: 'h4' }).closest('[data-grupo]') as HTMLElement)
        .getAllByRole('button')
        .map((b) => b.textContent);

    it('regla 179: tres grupos, cada uno en su orden fijo', () => {
      tareas(conTodo());
      expect(renglones('Atrasado')).toEqual([
        'Generar los alquileres de octubre1',
        'Indexaciones vencidas1',
        'Contratos con el plazo cumplido, sin renovar ni terminar1',
        'Boletas vencidas que paga la inmobiliaria$ 412.3001',
      ]);
      expect(renglones('Por vencer')).toEqual([
        'Boletas que vencen en 7 días$ 1.204.5002',
        'Contratos que vencen en 30 días2',
        'Renovaciones: contratos que vencen en 31 a 90 días2',
        'Generar los alquileres de noviembre1',
      ]);
      expect(renglones('Pendiente')).toEqual([
        'Diferencias por índice atrasado, sin cobrar$ 57.2691',
        'Reclamos abiertos1',
      ]);
    });

    it('regla 179: lo de hoy y lo de mañana va a «Por vencer»; lo de ayer, a «Atrasado»', () => {
      tareas(conTodo());
      fireEvent.click(screen.getByRole('button', { name: /^Boletas que vencen en 7 días/ }));
      const porVencer = within(screen.getByRole('dialog'));
      expect(porVencer.getByText('11', { selector: 'td *, td' })).toBeTruthy();
      expect(porVencer.getByText('12', { selector: 'td *, td' })).toBeTruthy();
      expect(porVencer.queryByText('10', { selector: 'td *, td' })).toBeNull();
      expect(porVencer.getByText('Total').parentElement).toHaveTextContent('$ 1.204.500,40');
    });

    it('regla 180: lo que está en cero no se muestra y se nombra en «Al día»; un grupo sin tareas no aparece', () => {
      tareas();
      expect(screen.getByText('Atrasado', { selector: 'h4' })).toBeInTheDocument();
      expect(screen.queryByText('Por vencer', { selector: 'h4' })).toBeNull();
      expect(screen.queryByText('Pendiente', { selector: 'h4' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Depósitos a devolver/ })).toBeNull();
      const alDia = screen.getByText(/^Al día:/).parentElement!;
      expect(alDia).toHaveTextContent('octubre generado');
      expect(alDia).toHaveTextContent('depósitos');
      // El mes siguiente todavía no se avisa: ni siquiera está en «Al día».
      expect(alDia).not.toHaveTextContent('noviembre');
    });

    it('regla 180: sin ninguna tarea, el bloque dice «Todo al día.»', () => {
      const base = tablero();
      tareas(tablero({ tareas: { ...base.tareas, indexacionesVencidas: vacio } }));
      expect(bloque('Lo que hay que hacer').getByText('Todo al día.')).toBeInTheDocument();
      expect(screen.queryByText(/^Al día:/)).toBeNull();
    });

    it('regla 180: un renglón abre su lista, con su acción', () => {
      tareas(conTodo());
      fireEvent.click(screen.getByRole('button', { name: /^Boletas vencidas que paga/ }));
      expect(
        within(screen.getByRole('dialog')).getByRole('link', { name: 'Ir a «Para pagar» →' }),
      ).toHaveAttribute('href', '/alquileres/impuestos?ver=pagar');
    });

    it('regla 181: generar el mes lleva a Conceptos con ese mes, y el estado de cada contrato', () => {
      tareas(conTodo());
      fireEvent.click(screen.getByRole('button', { name: /^Generar los alquileres de octubre/ }));
      const dialogo = within(screen.getByRole('dialog'));
      expect(dialogo.getByRole('table')).toHaveTextContent('Sin generar');
      expect(dialogo.getByRole('link', { name: 'Ir a generar →' })).toHaveAttribute(
        'href',
        '/alquileres/conceptos?periodo=2026-10',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      fireEvent.click(screen.getByRole('button', { name: /^Generar los alquileres de noviembre/ }));
      expect(
        within(screen.getByRole('dialog')).getByRole('link', { name: 'Ir a generar →' }),
      ).toHaveAttribute('href', '/alquileres/conceptos?periodo=2026-11');
    });

    it('regla 139: lo que espera el índice va en su tarea, y la lista no lo pinta «vencida»', () => {
      const base = tablero();
      const vigentes = ind([
        fila(5, null, { contrato: 'ALT-0005', indexa: '2026-10-01' }),
        fila(6, null, { contrato: 'ALT-0003', indexa: '2026-10-01' }),
      ]);
      const esperan = ind([
        fila(5, null, { contrato: 'ALT-0005', estado: 'Espera el IPC de septiembre de 2026' }),
      ]);
      tareas(
        tablero({
          cartera: { ...base.cartera, vigentes },
          tareas: { ...base.tareas, indexacionesVencidas: vacio, indexacionesEsperan: esperan },
        }),
      );
      expect(
        screen.getByRole('button', { name: /Indexaciones que esperan el índice/ }),
      ).toHaveTextContent('1');
      fireEvent.click(tarjeta(/^Cartera: /));
      const [, alt5, alt3] = within(screen.getByRole('dialog')).getAllByRole('row');
      expect(alt5).toHaveTextContent('01/10/2026 espera el índice');
      expect(alt3).toHaveTextContent('01/10/2026 vencida');
    });

    it('regla 166: las reservas vencidas y las que vencen, cada fila abre la reserva', () => {
      const reserva = (n: number, fecha: string) =>
        fila(n, 500, {
          id: `res${n}`,
          href: `/alquileres/reservas/res${n}`,
          contrato: null,
          detalle: `Reserva ${n}`,
          moneda: 'USD',
          fecha,
        });
      const base = tablero();
      tareas(
        tablero({
          tareas: {
            ...base.tareas,
            reservasPorVencer: ind([reserva(1, '2026-10-18'), reserva(2, '2026-10-24')]),
          },
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: /^Reservas vencidas/ }));
      const dialogo = within(screen.getByRole('dialog'));
      expect(dialogo.getAllByRole('link')[0]).toHaveAttribute('href', '/alquileres/reservas/res1');
      expect(dialogo.getByRole('link', { name: 'Ir a reservas →' })).toHaveAttribute(
        'href',
        '/alquileres/reservas',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      expect(
        screen.getByRole('button', { name: /^Reservas que vencen en 7 días/ }),
      ).toHaveTextContent('1');
    });
  });

  describe('Cómo vamos', () => {
    it('regla 182: abre en el año, que no se escribe; el mes sí se escribe, y cambiarlo no pide nada', () => {
      const replace = vi.spyOn(window.history, 'replaceState');
      tareas();
      expect(grupo('Período').getByRole('button', { name: 'Año' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(bloque('Cómo vamos').getByText('2026, hasta hoy')).toBeInTheDocument();
      fireEvent.click(grupo('Período').getByRole('button', { name: 'Mes' }));
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres?periodo=mes&mes=10');
      fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '3' } });
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres?periodo=mes&mes=3');
      fireEvent.click(grupo('Período').getByRole('button', { name: 'Año' }));
      expect(replace).toHaveBeenLastCalledWith(null, '', '/alquileres');
      expect(push).not.toHaveBeenCalled();
    });

    it('regla 182: el período de la dirección es el que se ve al entrar', () => {
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
      expect(bloque('Cómo vamos').getByText('Q1 2026')).toBeInTheDocument();
    });

    it('regla 182: cuatro tarjetas del período —ingresos, cobrado dentro del mes, contratos nuevos y cartera—', () => {
      tareas();
      const como = bloque('Cómo vamos');
      // Regla 75: el año es la suma de sus meses.
      expect(como.getByRole('button', { name: /^Ingresos: \$ 105\.000/ })).toHaveTextContent(
        'Honorarios$ 100.000',
      );
      // Regla 76: 2.600.000 de 3.537.518 al cierre de cada mes, sobre los totales.
      expect(como.getByRole('button', { name: /^Cobrado dentro del mes: 73%/ })).toHaveTextContent(
        'de $ 3,5 M emitidos',
      );
      expect(como.getByRole('button', { name: /^Contratos nuevos: 1/ })).toHaveTextContent(
        'Alquiler inicial $ 500.000',
      );
      expect(como.getByRole('button', { name: /^Cartera: 2/ })).toHaveTextContent(
        'vigentes a hoy$ 1,5 M por mes2 particulares · 0 comerciales',
      );
    });

    it('regla 182: cada tarjeta abre su lista; lo del período se pide al abrirlo', async () => {
      getDetalle.mockResolvedValue(ind([fila(5, 1_137_518), fila(6, 400_000)], true));
      render(
        <TableroAlquileres tableros={tres(tablero())} periodoInicial={{ por: 'mes', mes: 10 }} />,
      );
      fireEvent.click(tarjeta(/^Cobrado dentro del mes: /));
      const dialogo = within(
        screen.getByRole('dialog', { name: 'Alquileres emitidos de octubre 2026' }),
      );
      expect((await dialogo.findByText('Total')).parentElement).toHaveTextContent('$ 1.537.518,00');
      expect(getDetalle).toHaveBeenCalledWith('t', {
        indicador: 'importeEmitido',
        desde: '2026-10',
        hasta: '2026-10',
        moneda: 'ARS',
        tipo: 'todos',
      });
    });

    it('regla 182: contratos nuevos abre su lista, con el alquiler inicial y su total', () => {
      tareas();
      fireEvent.click(tarjeta(/^Contratos nuevos: 1/));
      const fila9 = within(within(screen.getByRole('dialog')).getByRole('table'))
        .getByText('9')
        .closest('tr')!;
      expect(fila9).toHaveTextContent('$ 500.000,00');
    });

    it('regla 77: un período que ya cerró muestra la cartera a su cierre, lo dice, y su lista se pide', async () => {
      getDetalle.mockResolvedValue(ind([fila(1, null)]));
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      const cartera = tarjeta(/^Cartera: 7/);
      expect(cartera).toHaveTextContent('vigentes al 31/03/2026');
      expect(cartera).toHaveTextContent('$ 3,0 M por mes');
      expect(cartera).toHaveTextContent('5 particulares · 2 comerciales');
      fireEvent.click(cartera);
      await within(screen.getByRole('dialog')).findByRole('table');
      expect(getDetalle).toHaveBeenCalledWith('t', {
        indicador: 'vigentes',
        desde: '2026-01',
        hasta: '2026-03',
        moneda: 'ARS',
        tipo: 'todos',
      });
    });

    it('regla 182: un solo gráfico, y la planilla plegada en «Ver mes por mes»', () => {
      tareas();
      expect(screen.getAllByRole('img', { name: /por mes de 2026/ })).toHaveLength(1);
      expect(screen.queryByRole('img', { name: /Contratos nuevos/ })).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
      const ver = screen.getByRole('button', { name: 'Ver mes por mes' });
      expect(ver).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(ver);
      expect(screen.getByRole('button', { name: 'Ocultar mes por mes' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      const planilla = screen.getByRole('table', {
        name: /alquileres e ingresos por mes de 2026/i,
      });
      const filas = within(planilla)
        .getAllByRole('row')
        .map((r) => r.firstElementChild?.textContent);
      expect(filas).toEqual([
        'Métrica',
        'Alquileres emitidos',
        'Cobrado al cierre',
        '% cobrado',
        'Ingresos',
        'Honorarios',
        'Gastos adm.',
        'Punitorios',
        'Comisiones e informes',
        'Contratos nuevos',
        'Alquiler inicial de los nuevos',
      ]);
      // Sin el pie: lo del período ya está en las tarjetas.
      expect(screen.queryByText(/cobrado al cierre de cada mes/)).toBeNull();
    });

    it('regla 80: con el trimestre, el gráfico y la planilla son de cuatro trimestres; tocar uno lo elige', () => {
      render(
        <TableroAlquileres
          tableros={tres(tablero())}
          periodoInicial={{ por: 'trimestre', q: 1 }}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Ver mes por mes' }));
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
      tareas();
      fireEvent.click(screen.getByRole('button', { name: 'Ver mes por mes' }));
      const planilla = screen.getByRole('table', {
        name: /alquileres e ingresos por mes de 2026/i,
      });
      const encabezados = within(planilla).getAllByRole('columnheader');
      expect(encabezados.filter((th) => th.getAttribute('aria-current'))).toEqual([]);
      fireEvent.click(within(encabezados[2]!).getByRole('button', { name: 'Feb' }));
      expect(screen.getByLabelText('Mes')).toHaveValue('2');
    });

    it('cambiar el año va a la misma página con ?anio=, y conserva el período', () => {
      render(
        <TableroAlquileres tableros={tres(tablero())} periodoInicial={{ por: 'mes', mes: 10 }} />,
      );
      fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2025' } });
      expect(push).toHaveBeenCalledWith('/alquileres?anio=2025&periodo=mes&mes=10', {
        scroll: false,
      });
    });

    it('el filtro Todos / Particulares / Comerciales cambia al instante, sin pedirle nada al servidor', () => {
      const replace = vi.spyOn(window.history, 'replaceState');
      tareas();
      fireEvent.click(screen.getByRole('button', { name: 'Comerciales' }));
      expect(screen.getByRole('button', { name: 'Comerciales' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(tarjeta(/^Cartera: 0/)).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith(null, '', '/alquileres?tipo=comercial');
    });

    it('un año sin alquileres generados lo dice, en vez de un gráfico en cero', () => {
      tareas(tablero({ evolucion: [], ingresos: [] }));
      expect(screen.getByText('Todavía no hay alquileres generados en 2026.')).toBeTruthy();
    });
  });

  it('regla 183: sin comparación con el año anterior en todo el Dashboard', () => {
    tareas();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mes por mes' }));
    // El año anterior solo está para elegirlo en el selector de año.
    expect(screen.queryByText(/2025/, { ignore: 'option, script, style' })).toBeNull();
    // Y los datos del año anterior que la API sigue mandando no se ven.
    expect(screen.getByRole('table')).not.toHaveTextContent('$50k');
  });

  it('regla 184: los importes de las tarjetas, abreviados; los de la lista, exactos', () => {
    tareas();
    expect(tarjeta(/^A liquidar a propietarios: \$ 1,9 M\. Ver/)).toBeInTheDocument();
    expect(tarjeta(/^Deuda vencida: \$ 350\.000\. Ver/)).toBeInTheDocument();
    fireEvent.click(tarjeta(/^A liquidar a propietarios: /));
    const tabla = within(within(screen.getByRole('dialog')).getByRole('table'));
    expect(tabla.getByText('$ 928.307,62')).toBeInTheDocument();
  });

  it('regla 184: en el teléfono entran dos tarjetas por fila', () => {
    tareas();
    for (const nombre of ['Hoy', 'Cómo vamos']) {
      const grilla = within(screen.getByRole('region', { name: nombre }))
        .getAllByRole('button', { name: /Ver el detalle/ })[0]!
        .closest('.grid')!;
      expect(grilla).toHaveClass('grid-cols-2');
    }
  });

  it('regla 185: sin íconos en tarjetas, títulos ni tareas; la urgencia, con los colores de urgencia', () => {
    const { container } = tareas();
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    // La lupa sigue: cada tarjeta que se abre la tiene.
    const cobranza = tarjeta(/^Cobranza de octubre: /);
    expect(cobranza.querySelector('svg')).not.toBeNull();
    // Lo atrasado va en `danger`, que ninguna inmobiliaria pisa; nunca en el color de la marca.
    const atrasado = screen.getByRole('button', { name: /Indexaciones vencidas/ });
    expect(atrasado.lastElementChild).toHaveClass('text-danger');
    expect(container.querySelector('[class*="text-brand-red"][data-falta]')).toBeNull();
  });

  it('regla 175: en la forma compacta (cada fila una vez) se ve igual, y el filtro sigue sin pedir nada', () => {
    const completa = tres(tablero());
    const { unmount } = render(<TableroAlquileres tableros={completa} />);
    const antes = document.body.textContent;
    unmount();
    render(<TableroAlquileres tableros={compactarTableros(completa)} />);
    expect(document.body.textContent).toBe(antes);
    fireEvent.click(screen.getByRole('button', { name: 'Comerciales' }));
    expect(tarjeta(/^Cartera: 0/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(getDetalle).not.toHaveBeenCalled();
  });

  it('si la lista no llega, lo dice', async () => {
    getDetalle.mockRejectedValue(new Error('caída'));
    tareas();
    fireEvent.click(tarjeta(/^Ingresos: /));
    expect(
      await within(screen.getByRole('dialog')).findByText(/No se pudo cargar la lista/),
    ).toBeInTheDocument();
  });
});
