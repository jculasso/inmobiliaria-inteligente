import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AgregadoKpi } from '@vacker/types';
import { TrimestreTabla } from './trimestre-tabla';

/**
 * El cuadro trimestral, con las mismas filas que la planilla de Vacker.
 *
 * Los cuatro trimestres tienen números distintos entre sí a propósito: con
 * valores repetidos, un error de índice —mostrar Q1 en la columna de Q3— pasa
 * desapercibido.
 */
const Q = (n: number): AgregadoKpi => ({
  volumen: n * 1000,
  operaciones: n * 2,
  puntas: n * 4,
  puntasCompradoras: n,
  puntasVendedoras: n * 3,
  comision: n * 30,
  comisionCompradora: n * 10,
  comisionVendedora: n * 20,
  ticketPromedio: 250, // 1000n / 4n
});
const DATOS = [Q(1), Q(2), Q(3), Q(4)];

/** Los valores de una fila, por su etiqueta: Q1..Q4 y el Total. */
function fila(label: string) {
  const celdas = within(screen.getByRole('row', { name: new RegExp(`^${label}`) })).getAllByRole('cell');
  return celdas.slice(1).map((c) => c.textContent ?? '');
}

describe('TrimestreTabla', () => {
  it('trae las nueve filas de la planilla', () => {
    render(<TrimestreTabla datos={DATOS} seleccionado={1} />);
    for (const label of [
      'Volumen USD', 'Operaciones', 'Ticket prom.', 'Puntas', 'P. compradoras',
      'P. vendedoras', 'Com. comprador', 'Com. vendedor', 'Total comisión',
    ]) {
      expect(screen.getByText(label), `falta la fila ${label}`).toBeInTheDocument();
    }
  });

  it('cada trimestre va en su columna y el total es la suma', () => {
    render(<TrimestreTabla datos={DATOS} seleccionado={1} />);
    // Operaciones: 2, 4, 6, 8 → total 20.
    expect(fila('Operaciones')).toEqual(['2', '4', '6', '8', '20']);
  });

  it('separa la comisión de comprador y de vendedor, y las dos cierran en el total', () => {
    render(<TrimestreTabla datos={DATOS} seleccionado={1} />);
    const soloNumero = (t: string) => Number(t.replace(/[^\d]/g, ''));
    const comp = fila('Com. comprador').map(soloNumero);
    const vend = fila('Com. vendedor').map(soloNumero);
    const total = fila('Total comisión').map(soloNumero);
    for (let i = 0; i < 5; i++) {
      expect(comp[i]! + vend[i]!, `la columna ${i} no cierra`).toBe(total[i]!);
    }
  });

  it('el ticket promedio NO se suma: se recalcula sobre el año', () => {
    /*
     * Es el error que este test existe para evitar. Los cuatro trimestres
     * tienen ticket 250; sumarlos daría 1.000, que no es el ticket de nadie.
     * El del año es volumen total (10.000) sobre puntas totales (40) = 250.
     */
    render(<TrimestreTabla datos={DATOS} seleccionado={1} />);
    const total = fila('Ticket prom.').at(-1)!;
    expect(total.replace(/[^\d]/g, '')).toBe('250');
  });

  it('al hacer click en un trimestre del encabezado, avisa cuál', async () => {
    const onSelect = vi.fn();
    render(<TrimestreTabla datos={DATOS} seleccionado={1} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Q3' }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('marca cuál es el trimestre que se está mirando', () => {
    render(<TrimestreTabla datos={DATOS} seleccionado={3} onSelect={vi.fn()} />);
    const marcadas = screen.getAllByRole('columnheader').filter((c) => c.getAttribute('aria-current') === 'true');
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]!.textContent).toContain('Q3');
  });
});
