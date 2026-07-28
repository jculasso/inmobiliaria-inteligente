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

function ultimaQuery(): URLSearchParams {
  const url = push.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split('?')[1] ?? '');
}

function renderEncabezado(
  opts: { activa?: boolean; dir?: 'asc' | 'desc'; enMemoria?: boolean; query?: string } = {},
) {
  const onOrdenar = vi.fn();
  params = new URLSearchParams(opts.query ?? '');
  render(
    <table>
      <thead>
        <tr>
          <EncabezadoOrdenable
            columna="codigo"
            activa={opts.activa ?? true}
            dir={opts.dir ?? 'desc'}
            enMemoria={opts.enMemoria ?? true}
            onOrdenar={onOrdenar}
          >
            Código
          </EncabezadoOrdenable>
        </tr>
      </thead>
    </table>,
  );
  return { onOrdenar };
}

describe('EncabezadoOrdenable — con la lista completa (ordena en memoria)', () => {
  it('avisa el nuevo orden sin ir al servidor', async () => {
    // Es el caso normal: 87 ventas ya están en el navegador. Navegar sería
    // pagar un viaje a EE.UU. para reordenar algo que ya está acá.
    const user = userEvent.setup();
    const { onOrdenar } = renderEncabezado({ activa: true, dir: 'desc' });

    await user.click(screen.getByRole('button'));

    expect(onOrdenar).toHaveBeenCalledWith({ orden: 'codigo', dir: 'asc' });
    expect(push).not.toHaveBeenCalled();
  });

  it('invierte el sentido en cada click', async () => {
    const user = userEvent.setup();
    const { onOrdenar } = renderEncabezado({ activa: true, dir: 'asc' });
    await user.click(screen.getByRole('button'));
    expect(onOrdenar).toHaveBeenCalledWith({ orden: 'codigo', dir: 'desc' });
  });

  it('si la columna estaba inactiva, arranca descendente', async () => {
    // Heredar el sentido de la columna anterior dejaría la firma más vieja
    // arriba al cambiar de columna, que no es lo que nadie quiere ver.
    const user = userEvent.setup();
    const { onOrdenar } = renderEncabezado({ activa: false, dir: 'asc' });
    await user.click(screen.getByRole('button'));
    expect(onOrdenar).toHaveBeenCalledWith({ orden: 'codigo', dir: 'desc' });
  });
});

describe('EncabezadoOrdenable — con la lista recortada (tiene que consultar)', () => {
  it('navega para que el servidor traiga las primeras del orden pedido', async () => {
    // Con más de 500 filas, ordenar en memoria ordenaría las 500 que bajaron,
    // no las 500 primeras del orden pedido: sería mostrar algo falso.
    const user = userEvent.setup();
    const { onOrdenar } = renderEncabezado({ activa: true, dir: 'desc', enMemoria: false });

    await user.click(screen.getByRole('button'));

    expect(onOrdenar).toHaveBeenCalled();
    expect(ultimaQuery().get('orden')).toBe('codigo');
    expect(ultimaQuery().get('dir')).toBe('asc');
  });

  it('conserva el resto de los filtros al navegar', async () => {
    const user = userEvent.setup();
    renderEncabezado({ enMemoria: false, query: 'anio=2026&trimestre=2&verTodo=1' });

    await user.click(screen.getByRole('button'));

    const q = ultimaQuery();
    expect(q.get('anio')).toBe('2026');
    expect(q.get('trimestre')).toBe('2');
    expect(q.get('verTodo')).toBe('1');
  });
});
