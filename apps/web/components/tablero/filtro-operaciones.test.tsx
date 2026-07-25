import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltroOperaciones } from './filtro-operaciones';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/protocolo/propiedades',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => push.mockReset());

/** Query aplicada en la última navegación. */
function ultimaQuery(): URLSearchParams {
  const url = push.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split('?')[1] ?? '');
}

describe('FiltroOperaciones', () => {
  it('con "Todos los años", elegir Trimestral asume el año en curso', async () => {
    // Regresión: sin año, un trimestre no define un rango y el backend ignoraba
    // el filtro — la pantalla decía "Q3" pero listaba todo.
    const user = userEvent.setup();
    render(<FiltroOperaciones />);

    await user.click(screen.getByRole('button', { name: 'trimestral' }));

    const q = ultimaQuery();
    expect(q.get('anio')).toBe(String(new Date().getFullYear()));
    expect(q.get('trimestre')).toBe(String(Math.ceil((new Date().getMonth() + 1) / 3)));
  });

  it('elegir Mensual asume el año y el mes en curso, no enero', async () => {
    const user = userEvent.setup();
    render(<FiltroOperaciones />);

    await user.click(screen.getByRole('button', { name: 'mensual' }));

    const q = ultimaQuery();
    expect(q.get('anio')).toBe(String(new Date().getFullYear()));
    expect(q.get('mes')).toBe(String(new Date().getMonth() + 1));
  });

  it('volver a "Todos los años" limpia el mes, para no dejar un filtro incoherente', async () => {
    const user = userEvent.setup();
    render(<FiltroOperaciones anio={2026} mes={7} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Año' }), '');

    const q = ultimaQuery();
    expect(q.get('anio')).toBeNull();
    expect(q.get('mes')).toBeNull();
    expect(q.get('trimestre')).toBeNull();
  });

  it('respeta el año elegido al cambiar de granularidad', async () => {
    const user = userEvent.setup();
    render(<FiltroOperaciones anio={2025} />);

    await user.click(screen.getByRole('button', { name: 'trimestral' }));

    expect(ultimaQuery().get('anio')).toBe('2025');
  });

  it('muestra Q1–Q4 en trimestral y el selector de mes en mensual', () => {
    const { unmount } = render(<FiltroOperaciones anio={2026} trimestre={2} />);
    expect(screen.getByRole('button', { name: 'Q2' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Mes' })).not.toBeInTheDocument();
    unmount();

    render(<FiltroOperaciones anio={2026} mes={7} />);
    expect(screen.getByRole('combobox', { name: 'Mes' })).toHaveValue('7');
    expect(screen.queryByRole('button', { name: 'Q2' })).not.toBeInTheDocument();
  });
});
