import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { IndicesDto } from '@vacker/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/alquileres/indices' }));

import { IndicesVista } from './indices-vista';

const icl: IndicesDto = {
  indice: 'ICL',
  fuente: 'BCRA · Índice para Contratos de Locación (diario)',
  ultimaFecha: '2026-10-05',
  actualizado: '2026-10-05T12:00:00Z',
  valores: [
    { fecha: '2026-10-05', valor: 28.5123, variacionMensual: null, variacionInteranual: null },
    { fecha: '2026-10-04', valor: 28.4977, variacionMensual: null, variacionInteranual: null },
  ],
};
const ipc: IndicesDto = {
  indice: 'IPC',
  fuente: 'INDEC · Índice de Precios al Consumidor (mensual)',
  ultimaFecha: '2026-08-01',
  actualizado: '2026-09-15T12:00:00Z',
  valores: [
    { fecha: '2026-08-01', valor: 12_076.3937, variacionMensual: 1.9, variacionInteranual: 32.4 },
    { fecha: '2026-07-01', valor: 11_851.2, variacionMensual: 2.1, variacionInteranual: 34.1 },
  ],
};

describe('IndicesVista (punto 3 de Javier)', () => {
  it('el ICL día por día, con su fuente y hasta cuándo está cargado', () => {
    render(<IndicesVista icl={icl} ipc={ipc} ver="icl" />);
    expect(screen.getByText(/Índice para Contratos de Locación/)).toBeInTheDocument();
    expect(screen.getByText('05/10/2026', { selector: 'span' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('28,5123')).toBeInTheDocument();
  });

  it('el IPC con la variación mensual y la interanual de cada mes', () => {
    render(<IndicesVista icl={icl} ipc={ipc} ver="icl" />);
    fireEvent.click(screen.getByRole('tab', { name: /IPC/ }));
    const meses = within(screen.getAllByRole('table').at(-1)!);
    const agosto = meses.getByText('Ago 2026').closest('tr')!;
    expect(agosto).toHaveTextContent('+1,9%');
    expect(agosto).toHaveTextContent('+32,4%');
  });
});
