import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EncabezadoOrdenable } from './encabezado-ordenable';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/tablero/ventas',
  useSearchParams: () => params,
}));

beforeEach(() => {
  push.mockReset();
  params = new URLSearchParams();
});

/** Query con la que se navegó la última vez. */
function ultimaQuery(): URLSearchParams {
  const url = push.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split('?')[1] ?? '');
}

function renderEn(query: string) {
  params = new URLSearchParams(query);
  return render(
    <table>
      <thead>
        <tr>
          <EncabezadoOrdenable columna="codigo">Código</EncabezadoOrdenable>
          <EncabezadoOrdenable columna="fechaFirma">Firma</EncabezadoOrdenable>
        </tr>
      </thead>
    </table>,
  );
}

describe('EncabezadoOrdenable', () => {
  it('al hacer click en una columna inactiva, ordena de mayor a menor', async () => {
    // Descendente primero porque es lo que se quiere mirar: lo más nuevo y lo
    // más reciente arriba. Empezar ascendente mostraría la operación más vieja.
    const user = userEvent.setup();
    renderEn('');

    await user.click(screen.getByRole('button', { name: /Firma/ }));

    expect(ultimaQuery().get('orden')).toBe('fechaFirma');
    expect(ultimaQuery().get('dir')).toBe('desc');
  });

  it('al hacer click en la columna activa, invierte el sentido', async () => {
    const user = userEvent.setup();
    renderEn('orden=codigo&dir=desc');

    await user.click(screen.getByRole('button', { name: /Código/ }));

    expect(ultimaQuery().get('dir')).toBe('asc');
  });

  it('y volver a hacer click la devuelve a descendente', async () => {
    const user = userEvent.setup();
    renderEn('orden=codigo&dir=asc');

    await user.click(screen.getByRole('button', { name: /Código/ }));

    expect(ultimaQuery().get('dir')).toBe('desc');
  });

  it('cambiar de columna arranca de nuevo en descendente', async () => {
    // Si heredara el sentido de la columna anterior, ordenar por fecha después
    // de haber puesto el código ascendente daría la firma más vieja arriba.
    const user = userEvent.setup();
    renderEn('orden=codigo&dir=asc');

    await user.click(screen.getByRole('button', { name: /Firma/ }));

    expect(ultimaQuery().get('orden')).toBe('fechaFirma');
    expect(ultimaQuery().get('dir')).toBe('desc');
  });

  it('conserva el resto de los filtros al ordenar', async () => {
    // Ordenar no puede resetear el año ni el "Ver todo": sería perder de vista
    // lo que se estaba mirando por haber tocado un encabezado.
    const user = userEvent.setup();
    renderEn('anio=2026&trimestre=2&verTodo=1');

    await user.click(screen.getByRole('button', { name: /Código/ }));

    const q = ultimaQuery();
    expect(q.get('anio')).toBe('2026');
    expect(q.get('trimestre')).toBe('2');
    expect(q.get('verTodo')).toBe('1');
  });

  it('sin orden en la URL, la columna activa es el código descendente', async () => {
    renderEn('');
    // Es el default del backend; el encabezado tiene que reflejarlo o la
    // pantalla muestra un orden distinto del que dice tener.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Código/ }));
    expect(ultimaQuery().get('dir')).toBe('asc');
  });
});
