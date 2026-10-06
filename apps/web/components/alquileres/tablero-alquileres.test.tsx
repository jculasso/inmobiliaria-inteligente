import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { FilaTablero, Indicador, TableroAlquileresDto } from '@vacker/types';
import { TableroAlquileres } from './tablero-alquileres';

const fila = (n: number, importe: number | null): FilaTablero => ({ id: `f${n}`, href: `/alquileres/contratos/c${n}`, contrato: String(n), persona: `Persona ${n}`, detalle: 'Calle', fecha: '2026-10-05', importe });
const ind = (filas: FilaTablero[], porImporte = false): Indicador => ({ valor: porImporte ? filas.reduce((s, f) => s + (f.importe ?? 0), 0) : filas.length, filas });
const vacio = ind([]);

const tablero = (over: Partial<TableroAlquileresDto> = {}): TableroAlquileresDto => ({
  hoy: '2026-10-20',
  mes: '2026-10',
  cartera: {
    vigentes: ind([fila(5, 1_137_518), fila(6, 400_000)]),
    vivienda: 2,
    comercial: 0,
    alquilerMensual: [{ moneda: 'ARS', indicador: ind([fila(5, 1_137_518), fila(6, 400_000)], true) }],
    propietarios: ind([fila(1, null)]),
    inquilinos: ind([fila(2, null), fila(3, null)]),
  },
  cobranza: [{ moneda: 'ARS', emitidos: ind([fila(5, 1), fila(6, 1)]), cobrados: ind([fila(5, 1)]), importeEmitido: ind([fila(5, 1_137_518), fila(6, 400_000)], true), importeCobrado: ind([fila(5, 1_137_518), fila(6, 150_000)], true) }],
  morosidad: [],
  evolucion: [{ mes: '2026-10', moneda: 'ARS', emitido: 1_537_518, cobrado: 1_287_518 }],
  ingresos: [],
  tareas: { indexacionesVencidas: ind([fila(5, null)]), indexacionesProximas: vacio, vencen: [{ dias: 30, indicador: vacio }, { dias: 60, indicador: vacio }, { dias: 90, indicador: vacio }], depositos: vacio, liquidaciones: vacio, deudores: vacio, sinFirmar: vacio },
  ...over,
});

describe('TableroAlquileres', () => {
  // Regla 26: el detalle de un importe cierra en el número de la tarjeta.
  it('una tarjeta abre su lista, y el total de la lista es el número', () => {
    render(<TableroAlquileres tablero={tablero()} />);
    fireEvent.click(screen.getByRole('button', { name: /Importe cobrado/ }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText('Total').parentElement).toHaveTextContent('$ 1.287.518');
    expect(screen.getByRole('button', { name: /Importe cobrado: \$ 1\.287\.518/ })).toBeInTheDocument();
    expect(dialogo.getAllByRole('link')[0]).toHaveAttribute('href', '/alquileres/contratos/c5');
  });

  // Regla 28.
  it('la cobranza dice el porcentaje de lo emitido', () => {
    render(<TableroAlquileres tablero={tablero()} />);
    expect(screen.getByText('50% de los emitidos')).toBeInTheDocument();
    expect(screen.getByText('84% de lo emitido')).toBeInTheDocument();
  });

  it('sin deuda vencida lo dice, en vez de tarjetas en cero', () => {
    render(<TableroAlquileres tablero={tablero()} />);
    expect(screen.getByText('Ningún inquilino tiene deuda vencida.')).toBeInTheDocument();
  });

  // Regla 31: lo que está en cero no se abre.
  it('lo que hay que hacer: con algo se abre, en cero no', () => {
    render(<TableroAlquileres tablero={tablero()} />);
    expect(screen.getByRole('button', { name: /Indexaciones vencidas/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Depósitos a devolver/ })).toBeDisabled();
  });
});
