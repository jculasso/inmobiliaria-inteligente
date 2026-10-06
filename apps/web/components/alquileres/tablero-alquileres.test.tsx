import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { FilaTablero, Indicador, TableroAlquileresDto, TablerosAlquileresDto } from '@vacker/types';
import { TableroAlquileres } from './tablero-alquileres';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/alquileres' }));

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
const ind = (filas: FilaTablero[], porImporte = false): Indicador => ({ valor: porImporte ? filas.reduce((s, f) => s + (f.importe ?? 0), 0) : filas.length, filas });
const vacio = ind([]);

const tablero = (over: Partial<TableroAlquileresDto> = {}): TableroAlquileresDto => ({
  hoy: '2026-10-20',
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
    alquilerMensual: [{ moneda: 'ARS', indicador: ind([fila(5, 1_137_518), fila(6, 400_000)], true) }],
  },
  cobranza: [{ moneda: 'ARS', emitidos: ind([fila(5, 1), fila(6, 1)]), cobrados: ind([fila(5, 1)]), importeEmitido: ind([fila(5, 1_137_518), fila(6, 400_000)], true), importeCobrado: ind([fila(5, 1_137_518), fila(6, 150_000)], true) }],
  morosidad: [],
  evolucion: [{ mes: '2026-10', moneda: 'ARS', emitido: 1_537_518, cobrado: 1_287_518 }],
  ingresos: [],
  tareas: { indexacionesVencidas: ind([fila(5, null)]), indexacionesProximas: vacio, vencen: [{ dias: 30, indicador: vacio }, { dias: 60, indicador: vacio }, { dias: 90, indicador: vacio }], depositos: vacio, liquidaciones: vacio, deudores: vacio, sinFirmar: vacio, escalones: vacio, reclamos: vacio, polizas: vacio, boletas: vacio },
  ...over,
});

/** Los tres cortes: el comercial, sin contratos, para notar el cambio. */
const tres = (t: TableroAlquileresDto): TablerosAlquileresDto => ({
  todos: t,
  vivienda: { ...t, tipo: 'vivienda' },
  comercial: { ...t, tipo: 'comercial', cartera: { ...t.cartera, vigentes: ind([]), vivienda: 0, comercial: 0 } },
});

describe('TableroAlquileres', () => {
  // Regla 26: el detalle de un importe cierra en el número de la tarjeta.
  it('una tarjeta abre su lista, y el total de la lista es el número', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.click(screen.getByRole('button', { name: /Importe cobrado/ }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText('Total').parentElement).toHaveTextContent('$ 1.287.518');
    expect(screen.getByRole('button', { name: /Importe cobrado: \$ 1\.287\.518/ })).toBeInTheDocument();
    expect(dialogo.getAllByRole('link')[0]).toHaveAttribute('href', '/alquileres/contratos/c5');
  });

  // Regla 28.
  it('la cobranza dice el porcentaje de lo emitido', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(screen.getByText('50% de los emitidos')).toBeInTheDocument();
    expect(screen.getByText('84% de lo emitido')).toBeInTheDocument();
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
      <TableroAlquileres tableros={tres(tablero({
          ingresos: [
            { mes: '2026-10', moneda: 'ARS', honorarios: 70_000, gastos: 5_000, punitorios: 0, comisiones: 0 },
            { mes: '2025-10', moneda: 'ARS', honorarios: 50_000, gastos: 0, punitorios: 0, comisiones: 0 },
          ],
        }))} />,
    );
    const planilla = screen.getByRole('table', { name: /alquileres e ingresos por mes de 2026/i });
    expect(within(planilla).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(expect.arrayContaining(['Ene', 'Dic']));
    expect(within(planilla).getByText('Ingresos 2025')).toBeTruthy();
    // El mes en curso viene elegido, con lo cobrado y lo del año anterior.
    expect(screen.getByText(/ingresos \$\s?75\.000,00 \(\$\s?50\.000,00 en 2025\)/i)).toBeTruthy();
  });

  it('cambiar el año va a la misma página con ?anio=', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2025' } });
    expect(push).toHaveBeenCalledWith('/alquileres?anio=2025', { scroll: false });
  });

  it('un año sin alquileres generados lo dice, en vez de un gráfico en cero', () => {
    render(<TableroAlquileres tableros={tres(tablero({ evolucion: [], ingresos: [] }))} />);
    expect(screen.getByText('Todavía no hay alquileres generados en 2026.')).toBeTruthy();
  });

  // Punto 8 de Javier: contratos nuevos del año, por trimestre y mes a mes.
  it('contratos nuevos: el año, cada trimestre y el año anterior para comparar', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    const nuevos = screen.getByRole('button', { name: /Nuevos en 2026: 1/ });
    expect(nuevos).toHaveTextContent('2 en 2025');
    expect(screen.getByRole('button', { name: /^Q1: 1/ })).toHaveTextContent('1 en 2025');
    expect(screen.getByRole('button', { name: /^Q2: 0/ })).toHaveTextContent('1 en 2025');
    fireEvent.click(nuevos);
    const fila9 = within(within(screen.getByRole('dialog')).getByRole('table')).getByText('9').closest('tr')!;
    expect(fila9).toHaveTextContent('Calle 9');
    expect(fila9).toHaveTextContent('$ 500.000,00');
  });

  // Javier, 6/10/2026: «como tiene una demora, parece que no está funcionando».
  it('el filtro Todos / Particulares / Comerciales cambia al instante, sin pedirle nada al servidor', () => {
    push.mockClear();
    const replace = vi.spyOn(window.history, 'replaceState');
    render(<TableroAlquileres tableros={tres(tablero())} />);
    expect(screen.getByRole('button', { name: /^Contratos vigentes: 2/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comerciales' }));
    expect(screen.getByRole('button', { name: 'Comerciales' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Contratos vigentes: 0/ })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(null, '', '/alquileres?tipo=comercial');
  });

  it('con todos, el reparto por tipo: cuántos contratos, cuánto por mes y qué parte; tocarlo filtra', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    const particulares = screen.getByTitle('Ver solo particulares');
    expect(particulares).toHaveTextContent('2 de 2 contratos');
    expect(particulares).toHaveTextContent('$ 1.537.518,00 por mes · 100%');
    fireEvent.click(particulares);
    expect(screen.getByRole('button', { name: 'Particulares' })).toHaveAttribute('aria-pressed', 'true');
  });

  // Javier, 6/10/2026: «Propietario, Inquilino, Importe Alquiler vigente, cuando indexa, cuando vence».
  it('contratos vigentes: cada uno con sus partes, alquiler de hoy, próxima indexación y vencimiento', () => {
    const vigentes = ind([fila(5, null, { alquiler: 1_137_518, indexa: '2026-12-15', vence: '2027-08-14' }), fila(6, null, { alquiler: 1_500, moneda: 'USD', indexa: '2026-10-01', vence: '2028-01-31' })]);
    render(<TableroAlquileres tableros={tres(tablero({ cartera: { ...tablero().cartera, vigentes } }))} />);
    fireEvent.click(screen.getByRole('button', { name: /^Contratos vigentes: / }));
    const tabla = within(screen.getByRole('dialog')).getByRole('table');
    expect(within(tabla).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Contrato', 'Propiedad', 'Inquilino', 'Propietario', 'Alquiler hoy', 'Próx. indexación', 'Vence']);
    const [, c5, c6] = within(tabla).getAllByRole('row');
    expect(c5).toHaveTextContent('Inquilino 5Dueño 5$ 1.137.518,0015/12/202614/08/2027');
    // En dólares, con su moneda; una indexación que ya pasó, marcada.
    expect(c6).toHaveTextContent('U$S 1.500,00');
    expect(c6).toHaveTextContent('01/10/2026 vencida');
  });

  it('una tarea lleva a donde se resuelve', () => {
    render(<TableroAlquileres tableros={tres(tablero())} />);
    fireEvent.click(screen.getByRole('button', { name: /Indexaciones vencidas/ }));
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Ir a indexar →' })).toHaveAttribute('href', '/alquileres/indexaciones');
  });
});
