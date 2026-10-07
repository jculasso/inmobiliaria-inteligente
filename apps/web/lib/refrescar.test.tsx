import { describe, expect, it, vi } from 'vitest';
import { Suspense, use, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * El refresh de mentira hace lo que hace el de Next: cambia lo que se pinta a
 * algo que suspende hasta que llega del servidor. Así se puede ver que
 * `refrescar()` espera a que llegue, y no solo a que se pida.
 */
let pedirAlServidor: () => void = () => {};
let llegaDelServidor: () => void = () => {};
const refresh = vi.fn(() => pedirAlServidor());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { useRefrescar } from './refrescar';

// Ya cumplida y marcada como tal: `use` la lee sin suspender.
const VIEJO = Object.assign(Promise.resolve('viejo'), { status: 'fulfilled', value: 'viejo' });

function Pagina({ datos }: { datos: Promise<string> }) {
  return <p>{use(datos)}</p>;
}

function Banco() {
  const [datos, setDatos] = useState<Promise<string>>(VIEJO);
  const [cerrado, setCerrado] = useState(false);
  const { refrescar, refrescando } = useRefrescar();
  pedirAlServidor = () => {
    let resolver!: (v: string) => void;
    setDatos(new Promise<string>((r) => (resolver = r)));
    llegaDelServidor = () => resolver('nuevo');
  };
  return (
    <>
      <Suspense fallback={<p>cargando</p>}>
        <Pagina datos={datos} />
      </Suspense>
      <button
        onClick={async () => {
          await refrescar();
          setCerrado(true);
        }}
      >
        Guardar
      </button>
      {refrescando && <span>Actualizando…</span>}
      {cerrado && <span>cerrado</span>}
    </>
  );
}

describe('useRefrescar', () => {
  it('la promesa se cumple recién cuando la página nueva se pintó', async () => {
    render(<Banco />);
    expect(await screen.findByText('viejo')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('Guardar')));
    expect(refresh).toHaveBeenCalledTimes(1);
    // Mientras viaja: lo viejo sigue a la vista (es una transición), el botón
    // dice que está actualizando, y el modal todavía no se cerró.
    expect(screen.getByText('viejo')).toBeInTheDocument();
    expect(screen.getByText('Actualizando…')).toBeInTheDocument();
    expect(screen.queryByText('cerrado')).not.toBeInTheDocument();

    await act(async () => llegaDelServidor());
    expect(await screen.findByText('nuevo')).toBeInTheDocument();
    expect(await screen.findByText('cerrado')).toBeInTheDocument();
    expect(screen.queryByText('Actualizando…')).not.toBeInTheDocument();
  });
});
